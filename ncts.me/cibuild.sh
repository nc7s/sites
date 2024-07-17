#!/bin/sh

hugo --gc --minify
ln public/ji.html public/ji/index.html
