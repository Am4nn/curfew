for i in $(seq 1 45); do
  line=$(bunx vercel ls 2>/dev/null | sed -n '6p')
  case "$line" in
    *Ready*)  echo "STATUS Ready"; echo "$line"; break ;;
    *Error*)  echo "STATUS Error"; echo "$line"; break ;;
    *Canceled*) echo "STATUS Canceled"; echo "$line"; break ;;
  esac
  sleep 20
done
echo "--- alias"
bunx vercel inspect https://dev.curfew.amanarya.com 2>&1 | grep -iE "^ *(url|status|created|id)|commit|sha" | head -12
echo "--- http"
curl -s -o /dev/null -w "dev.curfew.amanarya.com -> %{http_code}\n" https://dev.curfew.amanarya.com/ --max-time 30
