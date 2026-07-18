# MVP Scope

Related Linear issue: GHA-15

## Purpose

Ghassalny MVP proves that customers can discover petrol station car washes and reserve a reliable time slot, while station workers can operate the daily schedule without needing the customer to use the app.

The MVP should be useful with one pilot operator and a small number of branches before marketplace scale, payments, loyalty, or paid infrastructure are introduced.

## In Scope

- Customer account creation and login.
- Customer vehicle profile storage.
- Nearby branch discovery from manually stored branch coordinates.
- Branch detail page with address, services, pricing, working hours, and available slots.
- Slot generation from working hours, service duration, existing bookings, and blocked times.
- Customer booking creation, cancellation, and booking history.
- Worker daily schedule view for one assigned branch.
- Worker walk-in booking creation.
- Worker booking cancellation when operationally necessary.
- Business admin branch, service, worker, working-hours, and booking management.
- Platform-ready data model that separates operators, branches, users, and bookings.
- Local development with free tools and no paid cloud dependencies.

## Out of Scope

- Online payments.
- Refunds, wallet balances, loyalty points, coupons, and promo campaigns.
- Google Maps paid APIs.
- Automated SMS or WhatsApp notifications through paid providers.
- Multi-country localization beyond keeping the architecture ready for English and Arabic.
- Dynamic pricing, subscriptions, and enterprise contracts.
- Advanced analytics and finance reporting.
- Native station hardware integrations.
- Microservices.

## First Pilot Goal

Run a controlled pilot with one car wash operator and one to three branches in Cairo. The pilot should validate:

- Customers can find a branch and book without calling.
- Workers can trust the daily schedule.
- Walk-in bookings do not break app-booked slots.
- Admins can adjust services, hours, and availability without developer help.
- Manual branch coordinate entry is enough for the first release.

## MVP Success Measures

- A complete booking can be made from customer app to worker schedule.
- A worker can create a walk-in booking in less than two minutes.
- Admin setup for a new branch can be completed without database edits.
- Double-booking is prevented at the service layer and database boundary.
- The product can run locally without paid infrastructure.

