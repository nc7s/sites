#!/bin/sh

set -euo pipefail
shopt -s globstar

FILES_SIGNED=$(ls hugo.toml buildpub.sh content/**/*.* static/**/*.*)
COMMIT_ID=$(git rev-parse HEAD)

../hugo.sh --gc --minify

sha256sum $FILES_SIGNED | gpg --clearsign | tee public/sums.asc.txt
cp -r hugo.toml buildpub.sh content static public/
PUBLIC_FILES=$(cd public/ && ls)

git switch publish/ncts.me

(cd ../ && rm -rf $PUBLIC_FILES)
(cd public/ && mv $PUBLIC_FILES ../../)
(cd ../ &&
	git add $PUBLIC_FILES &&
	git commit -m "ncts.me: publish $COMMIT_ID" &&
	rm -r $PUBLIC_FILES)

git switch master
