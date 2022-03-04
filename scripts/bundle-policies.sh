# update the policies here
mkdir -p ./dist/policies/
bash ./scripts/bundle-policy.sh acme
bash ./scripts/bundle-policy.sh allow-everything