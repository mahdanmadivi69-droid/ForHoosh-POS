"""
Modendo POS ESC/POS Hardware Gateway
WebSocket Server & Direct LAN TCP Thermal Printer Dispatcher
Compatible with Modendo POS Floor Plan v6.3 & CafeOS Thermal KDS Dispatch
"""

import asyncio
import json
import socket
import logging
import os
import sys
from datetime import datetime
import websockets

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [Modendo-Gateway] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

PRINTER_CONFIG = {
    "bar": {"ip": "192.168.1.101", "port": 9100, "name": "Bar Station (80mm)"},
    "kitchen": {"ip": "192.168.1.102", "port": 9100, "name": "Kitchen Station (58/80mm)"}
}

CONNECTED_CLIENTS = set()

# Raw ESC/POS Command Byte Constants
ESC = b'\x1b'
GS = b'\x1d'
INIT_PRINTER = ESC + b'@'
ALIGN_CENTER = ESC + b'a\x01'
ALIGN_LEFT = ESC + b'a\x00'
ALIGN_RIGHT = ESC + b'a\x02'
BOLD_ON = ESC + b'E\x01'
BOLD_OFF = ESC + b'E\x00'
DOUBLE_SIZE = GS + b'!\x11'
NORMAL_SIZE = GS + b'!\x00'
PAPER_CUT = GS + b'V\x41\x10'
DRAWER_PULSE = ESC + b'p\x00\x19\xfa'

def send_to_thermal_printer(ip: str, port: int, payload: bytes) -> bool:
    """Send raw binary ESC/POS stream directly via TCP socket to LAN Thermal Printer."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(2.5)
            s.connect((ip, port))
            s.sendall(payload)
            logging.info(f"Ticket dispatched successfully to physical printer at {ip}:{port}")
            return True
    except Exception as e:
        # Fallback to local virtual spooler log for dev / test environments
        logging.warning(f"Physical printer unreachable at {ip}:{port} ({e}). Routing to virtual spooler buffer.")
        os.makedirs("logs", exist_ok=True)
        with open("logs/printer_spooler.log", "a", encoding="utf-8") as f:
            f.write(f"\n--- [TICKET DISPATCH {datetime.now().isoformat()} to {ip}:{port}] ---\n")
            f.write(f"Byte Length: {len(payload)} bytes\n")
            f.write(f"Raw HEX: {payload.hex()[:120]}...\n")
        return False

def build_escpos_ticket(table_id: any, waiter_name: str, station: str, items: list, venue_title: str = "MODENDO CAFE") -> bytes:
    """Build binary ESC/POS ticket with parameterized venue branding and item details."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    buf = bytearray()
    buf.extend(INIT_PRINTER)
    
    # Header: Venue Branding
    buf.extend(ALIGN_CENTER + BOLD_ON + DOUBLE_SIZE)
    buf.extend(f"{venue_title}\n".encode("utf-8"))
    buf.extend(NORMAL_SIZE + BOLD_OFF)
    buf.extend(f"STATION: {station.upper()}\n".encode("ascii", "ignore"))
    buf.extend(f"TABLE: #{table_id}  |  WAITER: {waiter_name}\n".encode("utf-8"))
    buf.extend(f"TIME: {now}\n".encode("ascii", "ignore"))
    buf.extend(b"------------------------------------------\n")
    
    # Items
    buf.extend(ALIGN_LEFT + BOLD_ON)
    for item in items:
        qty = item.get("qty", item.get("quantity", 1))
        name = item.get("name", item.get("nameFa", "Unknown Item"))
        note = item.get("notes", "")
        line = f"[{qty}x]  {name}\n"
        buf.extend(line.encode("utf-8"))
        if note:
            buf.extend(f"    * Note: {note}\n".encode("utf-8"))
    
    buf.extend(BOLD_OFF)
    buf.extend(b"------------------------------------------\n\n\n")
    buf.extend(PAPER_CUT)
    return bytes(buf)

async def dispatch_order(order: dict):
    """Segment items by preparation station (Bar vs Kitchen) and dispatch."""
    table_id = order.get("table_id", order.get("tableLabel", "0"))
    waiter = order.get("waiter", order.get("createdByUserName", "Staff"))
    items = order.get("items", [])

    tenant_id = order.get("tenantId") or order.get("tenant_id") or ""
    venue_title = order.get("venueTitle") or order.get("storeName")
    if not venue_title:
        if "100hich" in str(tenant_id).lower() or tenant_id == "tenant-100hich-01":
            venue_title = "100 HICH COFFEE ROASTERS"
        else:
            venue_title = "MODENDO CAFE"

    bar_items = [i for i in items if i.get("category") == "bar" or i.get("station") == "BAR"]
    kitchen_items = [i for i in items if i.get("category") == "kitchen" or i.get("station") == "KITCHEN"]

    # If neither categorized, default based on name or send all to bar
    if not bar_items and not kitchen_items:
        bar_items = items

    results = {}
    if bar_items:
        payload = build_escpos_ticket(table_id, waiter, "BAR", bar_items, venue_title=venue_title)
        results["bar"] = send_to_thermal_printer(PRINTER_CONFIG["bar"]["ip"], PRINTER_CONFIG["bar"]["port"], payload)

    if kitchen_items:
        payload = build_escpos_ticket(table_id, waiter, "KITCHEN", kitchen_items, venue_title=venue_title)
        results["kitchen"] = send_to_thermal_printer(PRINTER_CONFIG["kitchen"]["ip"], PRINTER_CONFIG["kitchen"]["port"], payload)

    return results

async def socket_handler(websocket):
    CONNECTED_CLIENTS.add(websocket)
    logging.info(f"Terminal connected. Active clients: {len(CONNECTED_CLIENTS)}")
    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "NEW_ORDER":
                order_payload = data.get("payload", {})
                logging.info(f"Incoming Order from Table {order_payload.get('table_id') or order_payload.get('tableLabel')}")
                
                # 1. Hardware dispatch to thermal printers
                dispatch_res = await dispatch_order(order_payload)

                # 2. Broadcast order status to all connected terminals
                sync_event = json.dumps({
                    "type": "ORDER_BROADCAST",
                    "status": "QUEUED",
                    "payload": order_payload,
                    "dispatchResults": dispatch_res,
                    "timestamp": datetime.now().isoformat()
                })
                if CONNECTED_CLIENTS:
                    await asyncio.gather(*[client.send(sync_event) for client in CONNECTED_CLIENTS if client.open])

                # 3. Optimistic ACK back to source terminal
                order_id = order_payload.get("order_id") or order_payload.get("id") or "ORD-NEW"
                ack = json.dumps({
                    "type": "ACK",
                    "status": "SUCCESS",
                    "order_id": order_id,
                    "message": "Order queued and tickets spooled"
                })
                await websocket.send(ack)

            elif msg_type == "PING":
                await websocket.send(json.dumps({"type": "PONG", "timestamp": datetime.now().isoformat()}))

    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        logging.error(f"Error handling websocket message: {e}")
    finally:
        CONNECTED_CLIENTS.discard(websocket)
        logging.info(f"Terminal disconnected. Active clients: {len(CONNECTED_CLIENTS)}")

async def main():
    port = int(os.environ.get("MODENDO_GATEWAY_PORT", 8080))
    host = os.environ.get("MODENDO_GATEWAY_HOST", "0.0.0.0")
    server = await websockets.serve(socket_handler, host, port)
    logging.info(f"Modendo POS Gateway running on ws://{host}:{port}/ws/pos")
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Modendo POS Gateway shutdown.")
