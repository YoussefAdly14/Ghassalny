# Personas and Roles

Related Linear issue: GHA-16

## Personas

### Customer

The customer wants to find a nearby reliable car wash, know what services are available, and avoid waiting in line.

Goals:

- Find nearby branches quickly.
- Compare basic services, prices, and working hours.
- Reserve a clear time slot.
- Manage vehicles and booking history.

Pain points:

- Calling stations wastes time.
- Car wash queues are unpredictable.
- Prices and service availability are often unclear.

Primary permissions:

- Manage own profile and vehicles.
- View public branch and service data.
- Create and cancel own bookings within policy.
- View own booking history.

### Station Worker

The worker needs a simple operational schedule for the branch they are working in today.

Goals:

- See today's bookings.
- Add walk-in customers without conflicts.
- Mark bookings as arrived, completed, canceled, or no-show.
- Block time when operations change.

Pain points:

- Customers arrive without reservations.
- Manual notebooks can create conflicts.
- Workers need fast screens, not admin complexity.

Primary permissions:

- View bookings for assigned branch.
- Create walk-in bookings for assigned branch.
- Update booking status for assigned branch.
- Add operational blocks for assigned branch when allowed.

### Business Admin

The business admin manages a car wash operator account, branches, services, workers, and schedule settings.

Goals:

- Configure branches and services.
- Manage working hours and capacity.
- Add or remove workers.
- Review bookings and operational activity.

Pain points:

- Each branch may operate differently.
- Staff changes must not require developer support.
- The business needs confidence that its data is isolated.

Primary permissions:

- Manage all branches within their organization.
- Manage workers within their organization.
- Manage service catalog, pricing, hours, and availability.
- View organization-level bookings and reports.

### Platform Admin

The platform admin operates Ghassalny itself.

Goals:

- Onboard car wash operators.
- Support tenants and resolve configuration issues.
- Audit usage and operational health.
- Prepare the product for SaaS or white-label sales.

Pain points:

- Tenant data must remain separated.
- Manual support actions need auditability.
- The platform should not depend on one pilot configuration.

Primary permissions:

- Manage organizations.
- View and support all tenants.
- Configure platform-level settings.
- Access audit and support tools.

### Future Station Owner

The station owner is a commercial stakeholder who may not operate the dashboard daily but cares about sales, visibility, and reliability.

Goals:

- Increase car wash utilization.
- Understand booking volume.
- Reduce customer waiting and complaints.
- Decide whether to continue using Ghassalny.

Pain points:

- Software must be easy to trust.
- Reports should be simple and actionable.
- The platform needs a path to paid features later.

Primary permissions:

- View organization reports.
- View branch performance.
- Delegate operational access to admins and workers.

## Egypt-Specific Assumptions

- The first market is Egypt, with Cairo as the initial pilot geography.
- Phone number login may become important, but email/password can support the first local build.
- Arabic and right-to-left support should be planned, but full localization can follow the MVP foundation.
- Branch coordinates can be collected manually at first instead of relying on paid geocoding APIs.
- Cash or on-site payment is assumed for MVP; online payments are deferred.

