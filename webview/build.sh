#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 embed_features.py
CC=${CC:-x86_64-w64-mingw32-gcc-posix}
CXX=${CXX:-x86_64-w64-mingw32-g++-posix}
"$CC" -E -xc -DRC_INVOKED app.rc -o app-preprocessed.rc
x86_64-w64-mingw32-windres app-preprocessed.rc --preprocessor=cat -O coff -o app-res.o
"$CXX" app.cpp app-res.o -std=c++17 -Os -s -static -municode -mwindows -lole32 -luuid -lshlwapi -lshell32 -lcomdlg32 -ladvapi32 -lwinhttp -lbcrypt -lcrypt32 -lversion -o ../Config_Inspector.exe
rm app-preprocessed.rc app-res.o
