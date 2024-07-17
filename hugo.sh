#!/bin/sh

podman run --rm -it --net host -v .:/work:z hugo-sites-local hugo $@
