#!/bin/sh

set -e

gem install asciidoctor
hugo --gc --minify
ln public/ji.html public/ji/index.html
cp -r hugo.toml makesig.sh content static public/
