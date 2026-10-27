@echo off
setlocal
cd /d "%~dp0.."
for /f "usebackq tokens=*" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do call "%%i\Common7\Tools\VsDevCmd.bat" -arch=x64 >nul
if errorlevel 1 exit /b 1
python scripts\version.py --check
if errorlevel 1 exit /b 1
python webview\embed_features.py
if errorlevel 1 exit /b 1
if not exist dist mkdir dist
if not exist build mkdir build
pushd webview
rc /nologo /fo ..\build\app.res app.rc
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /O1 /GL /Gy /Gw /MT /EHsc /DUNICODE /D_UNICODE /D_CRT_SECURE_NO_WARNINGS app.cpp ..\build\app.res /Fo..\build\app.obj /Fe..\dist\Config_Inspector.exe /link /LTCG /OPT:REF /OPT:ICF /MANIFEST:NO /SUBSYSTEM:WINDOWS ole32.lib uuid.lib shlwapi.lib shell32.lib comdlg32.lib advapi32.lib winhttp.lib bcrypt.lib crypt32.lib version.lib user32.lib gdi32.lib
if errorlevel 1 exit /b 1
popd
cl /nologo /std:c++17 /O1 /MT /EHsc tests\update-protocol-tests.cpp /Fobuild\protocol.obj /Febuild\update-protocol-tests.exe
if errorlevel 1 exit /b 1
build\update-protocol-tests.exe
if errorlevel 1 exit /b 1
rc /nologo /fo build\probe-old.res tests\update-probe.rc
if errorlevel 1 exit /b 1
rc /nologo /DTEST_NEW /fo build\probe-new.res tests\update-probe.rc
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /O1 /MT /EHsc /DUNICODE /D_UNICODE /D_CRT_SECURE_NO_WARNINGS tests\update-probe.cpp build\probe-old.res /Fobuild\probe-old.obj /Febuild\probe-old.exe /link advapi32.lib shell32.lib ole32.lib winhttp.lib bcrypt.lib crypt32.lib version.lib user32.lib
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /O1 /MT /EHsc /DUNICODE /D_UNICODE /D_CRT_SECURE_NO_WARNINGS tests\update-probe.cpp build\probe-new.res /Fobuild\probe-new.obj /Febuild\probe-new.exe /link advapi32.lib shell32.lib ole32.lib winhttp.lib bcrypt.lib crypt32.lib version.lib user32.lib
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /O1 /MT /EHsc /DUNICODE /D_UNICODE /D_CRT_SECURE_NO_WARNINGS tests\updater-windows-tests.cpp /Fobuild\windows-tests.obj /Febuild\updater-windows-tests.exe /link advapi32.lib shell32.lib ole32.lib winhttp.lib bcrypt.lib crypt32.lib version.lib user32.lib
if errorlevel 1 exit /b 1
build\updater-windows-tests.exe build\probe-old.exe build\probe-new.exe
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /O1 /MT /EHsc /DUNICODE /D_UNICODE /D_CRT_SECURE_NO_WARNINGS tests\updater-scheduler-tests.cpp /Fobuild\scheduler-tests.obj /Febuild\updater-scheduler-tests.exe /link advapi32.lib shell32.lib ole32.lib winhttp.lib bcrypt.lib crypt32.lib version.lib user32.lib
if errorlevel 1 exit /b 1
build\updater-scheduler-tests.exe
if errorlevel 1 exit /b 1
copy /y webview\index.html dist\Config_Inspector.html >nul
copy /y webview\icon.svg dist\Config_Inspector_Icon.svg >nul
python scripts\checksums.py
if errorlevel 1 exit /b 1
