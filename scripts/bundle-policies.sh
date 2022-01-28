# update the policies here
mkdir -p ./dist/policies/
sh ./scripts/bundle-policy.sh acme
sh ./scripts/bundle-policy.sh allow-everything