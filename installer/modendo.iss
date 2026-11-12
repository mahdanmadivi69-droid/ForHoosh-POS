; =====================================================================
; KarWand POS — Modendo Cafe Dedicated Installer Script
; Output: KarWand-Modendo-Setup-v0.16.exe
; Tenant: tenant-modendo-01 (Emerald Theme, Floor Map, Tables, Gaming Lounge)
; =====================================================================

#define MyAppName "صندوق کاروند (مودندو)"
#define MyAppEnglishName "KarWand POS - Modendo Cafe"
#define MyAppVersion "0.16.0"
#define MyAppPublisher "KarWand Software Technologies"
#define MyAppURL "https://smartorders.io"
#define MyAppExeName "KarWandLauncher.exe"
#define AppTenantId "tenant-modendo-01"

[Setup]
AppId={{C22MODENDO-9F0D-4E67-F012-84A3B91C490E}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}

DefaultDirName={localappdata}\KarWand POS Modendo
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes

OutputDir=..\dist-installer
OutputBaseFilename=KarWand-Modendo-Setup-v0.16
SetupIconFile=..\src-tauri\icons\icon.ico
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest

WizardStyle=modern
UninstallDisplayIcon={app}\icon.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "ایجاد آیکون روی دسکتاپ (Create Desktop Shortcut)"; GroupDescription: "آیکون‌ها:"; Flags: checkedonce
Name: "autostart"; Description: "اجرای خودکار هنگام بالا آمدن ویندوز (Launch on Windows Startup)"; GroupDescription: "اتوماسیون ترمینال:"; Flags: checkedonce

[Files]
Source: "..\src-tauri\icons\icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\modendo\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-win\KarWandLauncher.exe"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--autostart --kiosk"; IconFilename: "{app}\icon.ico"; Tasks: autostart

[Run]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""KarWand Modendo LAN Print Gateway (Port 9100)"" dir=in action=allow protocol=TCP localport=9100"; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall add rule name=""KarWand Modendo LAN Print Gateway Out (Port 9100)"" dir=out action=allow protocol=TCP localport=9100"; Flags: runhidden
Filename: "{app}\{#MyAppExeName}"; Description: "اجرای برنامه {#MyAppName}"; Flags: nowait postinstall skipifsilent skipifdoesntexist

[UninstallRun]
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""KarWand Modendo LAN Print Gateway (Port 9100)"""; Flags: runhidden
Filename: "{sys}\netsh.exe"; Parameters: "advfirewall firewall delete rule name=""KarWand Modendo LAN Print Gateway Out (Port 9100)"""; Flags: runhidden

[UninstallDelete]
Type: files; Name: "{app}\venue-config.json"
Type: filesandordirs; Name: "{app}\logs"

[Code]
procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFilePath, JsonContent, TimeStr: String;
begin
  if CurStep = ssPostInstall then
  begin
    TimeStr := GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':');
    ConfigFilePath := ExpandConstant('{app}\venue-config.json');

    JsonContent :=
      '{' + #13#10 +
      '  "tenantId": "tenant-modendo-01",' + #13#10 +
      '  "brandNameFa": "کافه بازی و لانج مودندو",' + #13#10 +
      '  "brandNameEn": "MODENDO BOARDGAME & GAMING CAFE",' + #13#10 +
      '  "theme": "emerald-lounge",' + #13#10 +
      '  "features": {' + #13#10 +
      '    "takeaway": true,' + #13#10 +
      '    "openTabs": true,' + #13#10 +
      '    "floorMap": true,' + #13#10 +
      '    "gamingLounge": true' + #13#10 +
      '  },' + #13#10 +
      '  "installedAt": "' + TimeStr + '"' + #13#10 +
      '}';

    SaveStringToFile(ConfigFilePath, JsonContent, False);
  end;
end;
