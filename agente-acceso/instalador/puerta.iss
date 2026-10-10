; Instalador del PC de la puerta (lector de huella + agente). No se compila a mano:
; lo arma `construir.ps1`, que prepara el paquete y pasa estas constantes.
;
; Lo que deja hecho, sin que quien instala toque nada:
;   1. El agente con su propio Node (no hace falta instalar Node).
;   2. El driver del lector ZK9500 (ZKFinger SDK), si aun no estaba.
;   3. Una tarea de Windows que arranca el agente AL ENCENDER el equipo, como SYSTEM.
;   4. El programa "GymBarichara Puerta" (escritorio y menu Inicio): la pantalla /acceso en
;      una ventana propia (Edge en modo aplicacion, que viene con Windows). Ahi se vincula el
;      equipo, se ve quien entra, y se apaga/enciende o reconecta el lector. La puerta NO
;      depende de esa ventana: el agente sigue funcionando aunque se cierre.

#ifndef Version
  #define Version "1.0.0"
#endif
#ifndef Web
  #define Web "https://gymbarichara.com"
#endif
#define UrlAcceso Web + "/acceso"
#define Edge "{commonpf32}\Microsoft\Edge\Application\msedge.exe"
#define ParametrosVentana "--app=" + UrlAcceso + " --start-maximized --autoplay-policy=no-user-gesture-required"
#define WebWww StringChange(Web, "://", "://www.")

[Setup]
AppId={{89791939-9115-4F66-A87C-18D52A671183}
AppName=GymBarichara Puerta
AppVersion={#Version}
AppVerName=GymBarichara Puerta {#Version}
AppPublisher=GymBarichara
AppPublisherURL={#Web}
DefaultDirName={autopf}\GymBarichara\Puerta
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=salida
OutputBaseFilename={#NombreSalida}
SetupIconFile={#Icono}
UninstallDisplayIcon={app}\puerta.ico
UninstallDisplayName=GymBarichara Puerta
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ShowLanguageDialog=no
CloseApplications=no

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
WelcomeLabel2=Esto deja este equipo listo para controlar la puerta con el lector de huella.%n%nConecta el lector ZK9500 por USB antes de seguir.

[Dirs]
; Aqui guarda el agente su configuracion (el puesto vinculado) y su registro.
Name: "{commonappdata}\GymBarichara\Puerta"; Permissions: users-modify

[Files]
Source: "{#Paquete}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "tarea.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#Icono}"; DestDir: "{app}"; DestName: "puerta.ico"; Flags: ignoreversion
Source: "{#SdkZk}"; DestDir: "{tmp}"; DestName: "zkfinger-sdk.exe"; Flags: deleteafterinstall; Check: FaltaDriverLector
#ifdef ConfigInicial
; Solo en instaladores de PRUEBA: apunta el agente a otro servidor.
Source: "{#ConfigInicial}"; DestDir: "{commonappdata}\GymBarichara\Puerta"; DestName: "config.json"; Flags: onlyifdoesntexist uninsneveruninstall
#endif

[Registry]
; Chrome/Edge 14x bloquean que una pagina de INTERNET hable con 127.0.0.1 ("Local Network
; Access") salvo permiso, y en la puerta nadie va a aceptarlo: sin esto la ventana no ve al
; agente (net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS). La politica autoriza SOLO a la web
; de GymBarichara. Efecto visible: el navegador dira "administrado por tu organizacion".
Root: HKLM; Subkey: "SOFTWARE\Policies\Microsoft\Edge\LocalNetworkAccessAllowedForUrls"; ValueType: string; ValueName: "1"; ValueData: "{#Web}"; Flags: uninsdeletevalue
Root: HKLM; Subkey: "SOFTWARE\Policies\Microsoft\Edge\LocalNetworkAccessAllowedForUrls"; ValueType: string; ValueName: "2"; ValueData: "{#WebWww}"; Flags: uninsdeletevalue uninsdeletekeyifempty
Root: HKLM; Subkey: "SOFTWARE\Policies\Google\Chrome\LocalNetworkAccessAllowedForUrls"; ValueType: string; ValueName: "1"; ValueData: "{#Web}"; Flags: uninsdeletevalue
Root: HKLM; Subkey: "SOFTWARE\Policies\Google\Chrome\LocalNetworkAccessAllowedForUrls"; ValueType: string; ValueName: "2"; ValueData: "{#WebWww}"; Flags: uninsdeletevalue uninsdeletekeyifempty

[Tasks]
Name: "alarrancar"; Description: "Abrir la ventana de la puerta al iniciar Windows"

[InstallDelete]
; La version 1.0 dejaba un enlace web; ahora es un programa con ventana propia.
Type: files; Name: "{commondesktop}\Puerta GymBarichara.url"

[Icons]
Name: "{commondesktop}\GymBarichara Puerta"; Filename: "{#Edge}"; Parameters: "{#ParametrosVentana}"; IconFilename: "{app}\puerta.ico"; Comment: "Control de acceso con huella"
Name: "{commonprograms}\GymBarichara Puerta"; Filename: "{#Edge}"; Parameters: "{#ParametrosVentana}"; IconFilename: "{app}\puerta.ico"; Comment: "Control de acceso con huella"
Name: "{commonstartup}\GymBarichara Puerta"; Filename: "{#Edge}"; Parameters: "{#ParametrosVentana}"; IconFilename: "{app}\puerta.ico"; Tasks: alarrancar

[Run]
Filename: "{tmp}\zkfinger-sdk.exe"; Parameters: "/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-"; StatusMsg: "Instalando el driver del lector de huella..."; Flags: waituntilterminated; Check: FaltaDriverLector
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tarea.ps1"" -Accion instalar -Carpeta ""{app}"""; StatusMsg: "Dejando la puerta lista para arrancar sola..."; Flags: runhidden waituntilterminated
Filename: "{#Edge}"; Parameters: "{#ParametrosVentana}"; Description: "Abrir GymBarichara Puerta"; Flags: postinstall nowait skipifsilent runasoriginaluser

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\tarea.ps1"" -Accion quitar -Carpeta ""{app}"""; Flags: runhidden waituntilterminated; RunOnceId: "QuitarTarea"


[Code]
{ El SDK de ZKTeco deja libzkfp.dll en System32. Si ya esta, no se reinstala. }
function FaltaDriverLector: Boolean;
begin
  Result := not FileExists(ExpandConstant('{sys}\libzkfp.dll'));
end;

#ifndef ConfigInicial
{ El instalador de PRODUCCION no puede heredar la config de uno de PRUEBA (apunta a otro
  servidor y su token es de otra base): si la hay, se borra y el equipo se vincula de nuevo.
  Una config de produccion (solo token) se conserva: actualizar no obliga a re-vincular. }
procedure QuitarConfigDePrueba;
var
  Archivo: String;
  Contenido: AnsiString;
begin
  Archivo := ExpandConstant('{commonappdata}\GymBarichara\Puerta\config.json');
  if FileExists(Archivo) and LoadStringFromFile(Archivo, Contenido) and (Pos('servidorApi', Contenido) > 0) then
    DeleteFile(Archivo);
end;
#endif

{ Al ACTUALIZAR, el agente viejo tiene sus archivos abiertos: se detiene antes de copiar. }
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  Codigo: Integer;
  Script: String;
begin
  Result := '';
  Script := ExpandConstant('{app}\tarea.ps1');
  if FileExists(Script) then
    Exec('powershell.exe',
      '-NoProfile -ExecutionPolicy Bypass -File "' + Script + '" -Accion detener -Carpeta "' + ExpandConstant('{app}') + '"',
      '', SW_HIDE, ewWaitUntilTerminated, Codigo);
#ifndef ConfigInicial
  QuitarConfigDePrueba;
#endif
end;
