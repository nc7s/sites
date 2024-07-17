#!/bin/sh

shopt -s globstar

sha256sum hugo.toml makesig.sh content/**/*.* static/**/*.* | gpg --clearsign | tee static/sums.asc.txt
