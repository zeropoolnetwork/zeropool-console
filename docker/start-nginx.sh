#!/usr/bin/env bash

echo 'Replacing env variables...'
original='env.js'
tmp=$(mktemp)
cp --attributes-only --preserve $original $tmp
cat $original | envsubst > $tmp && mv $tmp $original

nginx -g 'daemon off;'
