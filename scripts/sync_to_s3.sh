#!/bin/bash

# taken from https://gist.github.com/kevindice/87ee5ffca9523810253de3d9a41c3ae5

BUILD_DIR=$1
S3_BUCKET_NAME=$2
CREATE_INVALIDATION=$3
CLOUDFRONT_DISTRIBUTION_ID=$4

# Sync all files except for index.html
echo "Uploading files to $S3_BUCKET_NAME..."
aws s3 sync $BUILD_DIR s3://$S3_BUCKET_NAME/ \
  --exclude index.html

# Upload index.html
echo "Uploading index.html"
aws s3 cp $BUILD_DIR/index.html s3://$S3_BUCKET_NAME/index.html \
  --metadata-directive REPLACE \
  --cache-control max-age=0,no-cache,no-store,must-revalidate \
  --content-type text/html

if [ "$CREATE_INVALIDATION" = true ] ; then
  echo "Invalidating Cloudfront distribution"
  aws cloudfront create-invalidation --distribution-id $CLOUDFRONT_DISTRIBUTION_ID --paths '/*'
fi
