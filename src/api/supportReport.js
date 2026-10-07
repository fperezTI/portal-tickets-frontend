import client from './client';

// Staff manda customerId; un client no (el backend usa el de su JWT y lo ignora si viene).
export const getSupportReport = (params) => client.get('/support-report', { params }).then((r) => r.data);
export const listSupportReportCustomers = (params) =>
  client.get('/support-report/customers', { params }).then((r) => r.data);
