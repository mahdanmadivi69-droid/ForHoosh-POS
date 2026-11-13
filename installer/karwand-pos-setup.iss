#define MyAppName "KarWand POS"
#define MyAppVersion "0.15.0"
#define MyAppPublisher "KarWand Software Technologies"
#define MyAppURL "https://smartorders.io"
#define MyAppExeName "KarWandLauncher.exe"

[Setup]
AppId={{5E4C33B1-9F0D-4E67-F012-84A3B91C490E}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

DefaultDirName={localappdata}\KarWand POS
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
SetupIconFile=..\public\karwand-logo.ico

OutputDir=..\dist-installer
OutputBaseFilename=KarWand-Setup-v{#MyAppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest

WizardStyle=modern
UninstallDisplayIcon={app}\karwand-logo.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "autostart"; Description: "Launch KarWand POS automatically on Windows login"; GroupDescription: "Terminal Automation:"; Flags: checkedonce

[Files]
Source: "..\public\karwand-logo.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-win\KarWandLauncher.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-win\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\karwand-logo.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\karwand-logo.ico"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--autostart --kiosk"; IconFilename: "{app}\karwand-logo.ico"; Tasks: autostart

[Run]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""KarWand POS LAN Print Gateway (Port 9100)"" dir=in action=allow protocol=TCP localport=9100"; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""KarWand POS LAN Print Gateway Out (Port 9100)"" dir=out action=allow protocol=TCP localport=9100"; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""KarWand POS LAN Order Socket (Port 9101)"" dir=in action=allow protocol=TCP localport=9101 profile=private,domain"; Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""KarWand POS LAN Print Gateway (Port 9100)"""; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""KarWand POS LAN Print Gateway Out (Port 9100)"""; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""KarWand POS LAN Order Socket (Port 9101)"""; Flags: runhidden

[UninstallDelete]
Type: files; Name: "{app}\venue-config.json"
Type: filesandordirs; Name: "{app}\logs"

[Code]
var
  ConfigPage: TInputQueryWizardPage;
  TenantIdIndex, PrinterTypeIndex, PrinterIpIndex, PrinterPortIndex, ComPortIndex, BaudRateIndex: Integer;

procedure InitializeWizard;
var
  ParamTenant, ParamType, ParamIp, ParamPort, ParamCom, ParamBaud: String;
begin
  ConfigPage := CreateInputQueryPage(
    wpSelectDir,
    'Venue & Hardware Configuration',
    'Specify terminal identity, network routing, and serial COM port settings',
    'Configure how this terminal reaches its receipt printer (LAN TCP 9100 or Serial RS-232 COM port).'
  );

  TenantIdIndex    := ConfigPage.Add('Tenant Slug / Venue ID (e.g. 100hich, modendo):', False);
  PrinterTypeIndex := ConfigPage.Add('Printer Interface (LAN or SERIAL):', False);
  PrinterIpIndex   := ConfigPage.Add('LAN Printer IP (if using LAN):', False);
  PrinterPortIndex := ConfigPage.Add('LAN Port (Standard: 9100):', False);
  ComPortIndex     := ConfigPage.Add('Serial Port (if using SERIAL, e.g. COM1, COM3):', False);
  BaudRateIndex    := ConfigPage.Add('Serial Baud Rate (9600, 19200, 38400, 115200):', False);

  ConfigPage.Values[TenantIdIndex]    := '100hich';
  ConfigPage.Values[PrinterTypeIndex] := 'LAN';
  ConfigPage.Values[PrinterIpIndex]   := '192.168.1.200';
  ConfigPage.Values[PrinterPortIndex] := '9100';
  ConfigPage.Values[ComPortIndex]     := 'COM1';
  ConfigPage.Values[BaudRateIndex]    := '9600';

  ParamTenant := ExpandConstant('{param:TENANT|}');
  ParamType   := ExpandConstant('{param:PRINTERTYPE|}');
  ParamIp     := ExpandConstant('{param:PRINTERIP|}');
  ParamPort   := ExpandConstant('{param:PORT|}');
  ParamCom    := ExpandConstant('{param:COMPORT|}');
  ParamBaud   := ExpandConstant('{param:BAUD|}');

  if ParamTenant <> '' then ConfigPage.Values[TenantIdIndex]    := ParamTenant;
  if ParamType   <> '' then ConfigPage.Values[PrinterTypeIndex] := Uppercase(ParamType);
  if ParamIp     <> '' then ConfigPage.Values[PrinterIpIndex]   := ParamIp;
  if ParamPort   <> '' then ConfigPage.Values[PrinterPortIndex] := ParamPort;
  if ParamCom    <> '' then ConfigPage.Values[ComPortIndex]     := Uppercase(ParamCom);
  if ParamBaud   <> '' then ConfigPage.Values[BaudRateIndex]    := ParamBaud;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFilePath, JsonContent: String;
  TenantIdStr, TypeStr, IpStr, PortStr, ComStr, BaudStr, TimeStr: String;
begin
  if CurStep = ssPostInstall then
  begin
    TenantIdStr := Trim(ConfigPage.Values[TenantIdIndex]);
    TypeStr     := Uppercase(Trim(ConfigPage.Values[PrinterTypeIndex]));
    IpStr       := Trim(ConfigPage.Values[PrinterIpIndex]);
    PortStr     := Trim(ConfigPage.Values[PrinterPortIndex]);
    ComStr      := Uppercase(Trim(ConfigPage.Values[ComPortIndex]));
    BaudStr     := Trim(ConfigPage.Values[BaudRateIndex]);
    TimeStr     := GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':');

    if Length(PortStr) = 0 then PortStr := '9100';
    if Length(BaudStr) = 0 then BaudStr := '9600';
    if Length(ComStr) = 0  then ComStr  := 'COM1';
    if Length(IpStr) = 0   then IpStr   := '192.168.1.200';

    ConfigFilePath := ExpandConstant('{app}\venue-config.json');

    JsonContent :=
      '{' + #13#10 +
      '  "tenantId": "' + TenantIdStr + '",' + #13#10 +
      '  "hardwareProfile": {' + #13#10 +
      '    "cashierPrinter": {' + #13#10 +
      '      "connectionType": "' + TypeStr + '",' + #13#10 +
      '      "host": "' + IpStr + '",' + #13#10 +
      '      "port": ' + PortStr + ',' + #13#10 +
      '      "serialPort": "' + ComStr + '",' + #13#10 +
      '      "baudRate": ' + BaudStr + ',' + #13#10 +
      '      "flowControl": "NONE",' + #13#10 +
      '      "paperWidth": "80mm"' + #13#10 +
      '    }' + #13#10 +
      '  },' + #13#10 +
      '  "offlineEngine": {' + #13#10 +
      '    "indexedDbPrefix": "CafeOS_' + TenantIdStr + '_DB",' + #13#10 +
      '    "syncIntervalMs": 30000' + #13#10 +
      '  },' + #13#10 +
      '  "installedAt": "' + TimeStr + '"' + #13#10 +
      '}';

    SaveStringToFile(ConfigFilePath, JsonContent, False);
  end;
end;