# Hosting and running costs

Decided on 2026-10-09. These are estimates from published list prices, not quotes.

## Where the app runs

Everything runs on **AWS in Ireland (`eu-west-1`)**: the web app (AWS Amplify
Hosting), the PostgreSQL database (Amazon RDS) and the daily reminder schedule
(EventBridge). The setup steps are in the [README](../README.md#hosting-with-a-custom-domain).

- **Why not Cape Town:** Amplify Hosting isn't offered in `af-south-1`
  ([AWS endpoint list](https://docs.aws.amazon.com/general/latest/gr/amplify.html)).
  Running everything in Cape Town would need a container setup (ECS Fargate +
  load balancer + RDS) at about R1,330 to R1,570 a month, roughly twice the cost.
- **Why the database is in Ireland too:** each page makes several database
  queries, and Cape Town to Ireland is about 150 ms each way, so splitting the
  server and the database would make every screen slow.
- **POPIA:** section 72 allows personal information to be stored in the EU
  because GDPR gives equivalent protection. The clinic's privacy notice and
  consent forms should say that records are stored with AWS in Ireland.
- **No Vercel:** nothing may depend on Vercel or other hosts.

## Monthly costs

Expected usage: 8 staff, about 200 clients a month. Exchange rate R18 = US$1.

| Item | What it is | US$ | Rand |
| --- | --- | --- | --- |
| Web hosting | Runs the portal and its web address (AWS Amplify) | 2 to 5 | 40 to 90 |
| Database | Patient records, encrypted, daily backups (Amazon RDS, smallest size, 20 GB) | 18 to 20 | 320 to 360 |
| WhatsApp messages | About 600 a month: confirmations, reminders, doctor approvals (Twilio + Meta) | 8 to 10 | 140 to 180 |
| Email | Confirmations and signed consent forms (Resend free tier, up to 3,000 a month) | 0 | 0 |
| Supporting services | Reminder schedule, secret storage, DNS, logs | 2 to 4 | 40 to 70 |
| Code and CI | GitHub (free tier) | 0 | 0 |
| **Total** | | **30 to 39** | **540 to 700** |

### Recommended additions

| Addition | Why | US$ | Rand |
| --- | --- | --- | --- |
| Standby database (Multi-AZ) | Takes over automatically if the main database fails | +13 to 16 | +230 to 290 |
| Test site (staging) | Changes are tried on a separate copy before going live | +15 to 20 | +270 to 360 |
| **Total with additions** | | **58 to 75** | **1,050 to 1,350** |

### Once-off and yearly

| Item | Cost |
| --- | --- |
| `.co.za` domain | about R100 to R200 a year |
| Meta business verification, WhatsApp sender and template approval | free |
| Twilio WhatsApp number, if the clinic doesn't use its own | about US$1 to US$15 a month |

## How costs grow

- **Per client:** about 3 WhatsApp messages, roughly US$0.045 (80 cents).
  Meta's South African utility rate is US$0.0095 per message from 1 October
  2026 ([source](https://whautomate.com/whatsapp-business-api-pricing-south-africa)),
  plus Twilio's fee of about US$0.005.
- **Per staff member:** nothing; there are no per-user licences.
- **Server and database:** the smallest sizes handle several thousand clients a month.

Development, support and maintenance fees are not included. The client-facing
version of this breakdown is a shared document:
https://claude.ai/code/artifact/637cf281-6488-415c-9634-1c80203c4308
