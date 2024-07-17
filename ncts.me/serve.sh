#!/bin/sh

rm -r public/
../hugo.sh
ln public/ji.html public/ji/index.html
../hugo.sh serve $@
