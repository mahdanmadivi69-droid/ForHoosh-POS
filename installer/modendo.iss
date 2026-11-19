; =====================================================================
; KarWand POS — Modendo Cafe Dedicated Installer Script
; Output: KarWand-Modendo-Setup-v0.16.1.exe
; Tenant: tenant-modendo-01 (Emerald Theme, Floor Map, Tables, Gaming Lounge)
; Mode: Local-First (Offline by default, optional skippable cloud sync)
; =====================================================================

#define MyAppName "صندوق کاروند (مودندو)"
#define MyAppEnglishName "KarWand POS - Modendo Cafe"
#define MyAppVersion "0.16.1"
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
OutputBaseFilename=KarWand-Modendo-Setup-v0.16.1
SetupIconFile=..\public\karwand-logo.ico
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=lowest

WizardStyle=modern
UninstallDisplayIcon={app}\karwand-logo.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "ایجاد آیکون روی دسکتاپ (Create Desktop Shortcut)"; GroupDescription: "آیکون‌ها:"; Flags: checkedonce
Name: "autostart"; Description: "اجرای خودکار هنگام بالا آمدن ویندوز (Launch on Windows Startup)"; GroupDescription: "اتوماسیون ترمینال:"; Flags: checkedonce

[Files]
Source: "..\public\karwand-logo.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist\modendo\*"; DestDir: "{app}\ui"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\dist-win\KarWandLauncher.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\dist-win\venue-config.json"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\karwand-logo.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\karwand-logo.ico"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--autostart --kiosk"; IconFilename: "{app}\karwand-logo.ico"; Tasks: autostart

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
var
  CloudPage: TInputQueryWizardPage;
  TenantLockedIndex: Integer;
  CloudDbUrlIndex: Integer;

procedure InitializeWizard;
begin
  CloudPage := CreateInputQueryPage(
    wpSelectDir,
    'اتصال ابری و هویت شعبه (Cloud Sync & Venue Identity)',
    'پیکربندی هویت مودندو و همگام‌سازی ابری — پیش‌فرض: آفلاین و محلی (Local-First)',
    'هویت این پایانه روی کافه مودندو (tenant-modendo-01) قفل شده است.' + #13#10 +
    'سامانه به صورت پیش‌فرض کاملاً آفلاین (Local-First) کار می‌کند. در صورت عدم نیاز به سرور ابری، فیلد زیر را خالی بگذارید و روی Next بزنید (Skip).'
  );

  TenantLockedIndex := CloudPage.Add('شناسه کافه / Tenant ID (قفل روی مودندو):', False);
  CloudDbUrlIndex   := CloudPage.Add('آدرس پایگاه ابری / Cloud DB URL (اختیاری - خالی = آفلاین):', False);

  CloudPage.Values[TenantLockedIndex] := 'tenant-modendo-01';
  CloudPage.Values[CloudDbUrlIndex]   := '';

  CloudPage.Edits[TenantLockedIndex].ReadOnly := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFilePath, JsonContent, TimeStr, CloudDbUrl, CloudSyncJson: String;
begin
  if CurStep = ssPostInstall then
  begin
    TimeStr := GetDateTimeString('yyyy-mm-dd hh:nn:ss', '-', ':');
    ConfigFilePath := ExpandConstant('{app}\venue-config.json');

    CloudDbUrl := Trim(CloudPage.Values[CloudDbUrlIndex]);
    if Length(CloudDbUrl) > 0 then
    begin
      CloudSyncJson :=
        '  "cloudSync": {' + #13#10 +
        '    "enabled": true,' + #13#10 +
        '    "mode": "cloud-connected",' + #13#10 +
        '    "databaseUrl": "' + CloudDbUrl + '",' + #13#10 +
        '    "syncIntervalMs": 30000' + #13#10 +
        '  },';
    end
    else
    begin
      CloudSyncJson :=
        '  "cloudSync": {' + #13#10 +
        '    "enabled": false,' + #13#10 +
        '    "mode": "local-first",' + #13#10 +
        '    "syncIntervalMs": 30000' + #13#10 +
        '  },';
    end;

    JsonContent :=
      '{' + #13#10 +
      '  "tenantId": "tenant-modendo-01",' + #13#10 +
      '  "brandNameFa": "کافه گیمینگ مودندو",' + #13#10 +
      '  "brandNameEn": "MODENDO GAMING LOUNGE",' + #13#10 +
      '  "theme": "modendo",' + #13#10 +
      '  "features": {' + #13#10 +
      '    "takeaway": true,' + #13#10 +
      '    "openTabs": true,' + #13#10 +
      '    "floorMap": true,' + #13#10 +
      '    "gamingLounge": true' + #13#10 +
      '  },' + #13#10 +
      CloudSyncJson + #13#10 +
      '  "hardwareProfile": {' + #13#10 +
      '    "cashierPrinter": {' + #13#10 +
      '      "connectionType": "LAN",' + #13#10 +
      '      "host": "192.168.1.200",' + #13#10 +
      '      "port": 9100,' + #13#10 +
      '      "serialPort": "COM1",' + #13#10 +
      '      "baudRate": 9600,' + #13#10 +
      '      "flowControl": "NONE",' + #13#10 +
      '      "paperWidth": "80mm"' + #13#10 +
      '    }' + #13#10 +
      '  },' + #13#10 +
      '  "offlineEngine": {' + #13#10 +
      '    "indexedDbPrefix": "CafeOS_Modendo_DB",' + #13#10 +
      '    "syncIntervalMs": 30000' + #13#10 +
      '  },' + #13#10 +
      '  "installedAt": "' + TimeStr + '"' + #13#10 +
      '}';

    SaveStringToFile(ConfigFilePath, UTF8Encode(JsonContent), False);
  end;
end;
