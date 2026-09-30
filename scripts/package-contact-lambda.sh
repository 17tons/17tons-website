#!/bin/sh
# Packages the contact Lambda into build/contact-lambda.zip. The AWS SDK comes with the Node.js
# runtime, so the archive holds only the handler modules and the manifest that marks them as ESM.
set -eu

out=build/contact-lambda
rm -rf "$out" build/contact-lambda.zip
mkdir -p "$out/server/contact"
cp server/contact/*.js "$out/server/contact/"
printf '{ "type": "module" }\n' > "$out/package.json"
(cd "$out" && python3 -m zipfile -c ../contact-lambda.zip package.json server)
echo "build/contact-lambda.zip"
