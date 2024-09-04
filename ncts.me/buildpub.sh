#!/bin/sh

set -euo pipefail
shopt -s globstar

DRAFTS=$(grep -E '^draft\s+=\s+true' content/**/*.* | awk -F: '{print $1}')
CONTENTS_SIGNED=$(for i in content/**/*.*; do
	case $DRAFTS in
		*$i*)
			;;
		*)
			echo $i
			;;
	esac
done)

FILES_SIGNED=$(ls hugo.toml buildpub.sh static/**/*.*)
COMMIT_ID=$(git rev-parse HEAD)

../hugo.sh --gc --minify

(
	date --iso-8601=seconds
	echo sha256sum
	sha256sum $CONTENTS_SIGNED $FILES_SIGNED
) | gpg --clearsign | tee public/sums.asc.txt
cp -r hugo.toml buildpub.sh content static public/
PUBLIC_FILES=$(cd public/ && rm -f dummy $DRAFTS && ls)

git switch publish/ncts.me

(cd ../ && rm -rf $PUBLIC_FILES)
(cd public/ && mv $PUBLIC_FILES ../../)
(cd ../ &&
	git add $PUBLIC_FILES &&
	git commit -m "ncts.me: publish $COMMIT_ID" &&
	rm -r $PUBLIC_FILES)

git switch master
