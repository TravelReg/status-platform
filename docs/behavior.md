# Status Platform Behavior

## Health checks

- Check each monitored service every 60 seconds.
- Stop waiting after 5 seconds if a service does not respond.
- HTTP status codes 200–399 count as successful.
- HTTP status codes 400–599, timeouts, and connection errors count as failures.
- Mark a service down after two consecutive failed checks.
- Mark a service operational again after two consecutive successful checks.
- Show unknown when there is no result yet or no result has arrived for 3 minutes.

## Probe records

Store the service ID, probe region, check time in UTC, HTTP status (if received), response time, and whether the check succeeded. Include the region from the beginning, even though the first deployment has only one probe region.

## Incidents

An authenticated admin can create, update, and resolve incidents. Incidents are separate from automatic health-check results.

## Public information

Visitors can view current service status, recent check history, and incidents. Visitors cannot submit probe results or change incidents.
