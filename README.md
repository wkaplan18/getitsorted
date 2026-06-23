# BillBot — Setup Checklist

## 1. Supabase
1. Create a new Supabase project
2. Run `supabase/schema.sql` in the SQL editor
3. Copy URL + anon key + service role key into `.env.local`

## 2. Clickatell
1. Sign up at clickatell.com → create a WhatsApp channel
2. Get your API key → add to `.env.local`
3. Set your webhook URL to: `https://your-app.vercel.app/api/webhook`
4. Note your WhatsApp number (format: 27XXXXXXXXXX)

## 3. Anthropic
1. Get an API key from console.anthropic.com
2. Add to `.env.local`

## 4. Deploy to Vercel
```bash
npm install
vercel deploy
```

## 5. Reminders cron
At cron-job.org, create a daily job:
```
GET https://your-app.vercel.app/api/reminders?secret=YOUR_CRON_SECRET
```

## 6. Test it
Forward a PDF invoice on WhatsApp to your BillBot number.
Check the dashboard at your Vercel URL.
