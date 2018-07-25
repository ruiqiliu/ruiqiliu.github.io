#!/bin/bash

echo input is $1

cd _posts

hexo new $1

echo "create new post $1.md" 

ln $*.md /Users/liuruiqi/workspace/CommonToolsTotorial/Java

