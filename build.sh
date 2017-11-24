#!/bin/bash

set -euxo pipefail

archive=tab-polish.zip
version=$(git describe --tags | sed 's/^v//' | cut -d'-' -f1,1)
react-scripts build
cp *.png ./build
cp manifest.json ./build
sed -i 's/@@VERSION@@/'$version'/g' ./build/manifest.json
find ./build -type f
(cd build && zip -r9 - .) > $archive
echo "$archive v$version created."
