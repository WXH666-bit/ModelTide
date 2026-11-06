Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
Var Updating
Name "ModelTide"
OutFile "${PROJECT_ROOT}\release\ModelTide-${APP_VERSION}-Setup-x64.exe"
InstallDir "$LOCALAPPDATA\Programs\ModelTide"
InstallDirRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "${PROJECT_ROOT}\src\ui\assets\modeltide.ico"
UninstallIcon "${PROJECT_ROOT}\src\ui\assets\modeltide.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\ModelTide.exe"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/UPDATE" $1
  ${IfNot} ${Errors}
    StrCpy $Updating "1"
  ${EndIf}
FunctionEnd
Section "Install"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  ClearErrors
  File /r "${PROJECT_ROOT}\release\win-unpacked\*"
  ${If} ${Errors}
    SetErrorLevel 1
    Quit
  ${EndIf}
  ${If} $Updating == "1"
    ; Updating in place preserves user settings, startup entries and shortcuts.
    ; Portable development builds must not create installed-app registry entries.
    ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "InstallLocation"
    ${If} $0 == $INSTDIR
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "DisplayVersion" "${APP_VERSION}"
      WriteUninstaller "$INSTDIR\Uninstall.exe"
    ${EndIf}
    SetErrorLevel 0
    Goto install_done
  ${EndIf}
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\ModelTide"
  CreateShortcut "$SMPROGRAMS\ModelTide\ModelTide.lnk" "$INSTDIR\ModelTide.exe"
  CreateShortcut "$SMPROGRAMS\ModelTide\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "DisplayName" "ModelTide"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "DisplayIcon" "$INSTDIR\ModelTide.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide" "NoRepair" 1
  install_done:
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ModelTide"
  ${If} $0 == '"$INSTDIR\ModelTide.exe"'
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ModelTide"
  ${EndIf}
  ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ModelTideWatcher"
  ${If} $0 == '"$INSTDIR\ModelTide-Watcher.exe"'
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ModelTideWatcher"
  ${EndIf}
  !include "${PROJECT_ROOT}\release\uninstall-files.nsh"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\ModelTide\ModelTide.lnk"
  Delete "$SMPROGRAMS\ModelTide\Uninstall.lnk"
  RMDir "$SMPROGRAMS\ModelTide"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ModelTide"
  ; Keep %APPDATA%\ModelTide settings and usage index.
SectionEnd
