var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function riceItem(price) {
  return {
    id: 1,
    name: 'Rice',
    sku: 'RICE-1',
    hsn: '1006',
    price: price,
    qty: 1
  };
}

test('invoice uses the item HSN slab for GST', function () {
  var items = [riceItem(100)];
  var billed = pricing.computeTotals(items, '');
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: items,
    coupon: ''
  });

  assert.deepStrictEqual({
    tax: billed.tax,
    total: billed.total
  }, {
    tax: 5,
    total: 105
  });
  assert.deepStrictEqual({
    tax: invoiceFigures.tax,
    total: invoiceFigures.total,
    displayedGstPercent: invoiceFigures.rows[0].gstPercent
  }, {
    tax: 5,
    total: 105,
    displayedGstPercent: 5
  });
});

test('invoice applies coupon discounts before GST', function () {
  var items = [riceItem(1000)];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiceFigures = invoice.computeInvoiceFigures({
    items: items,
    coupon: 'SAVE10'
  });

  assert.deepStrictEqual({
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  }, {
    discount: 100,
    tax: 45,
    total: 945
  });
  assert.deepStrictEqual({
    discount: invoiceFigures.discount,
    tax: invoiceFigures.tax,
    total: invoiceFigures.total
  }, {
    discount: 100,
    tax: 45,
    total: 945
  });
});

test('GST reconciliation matches invoice figures to stored billed figures', function () {
  var items = [riceItem(100)];
  var billed = pricing.computeTotals(items, '');
  var db = {
    orders: [{
      id: 1001,
      date: '21/11/2026',
      customer: 'Walk-in',
      status: 'completed',
      items: items,
      coupon: '',
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  };

  var reconciliation = reports.getGstReconciliation(db);

  assert.strictEqual(reconciliation.totalChecked, 1);
  assert.strictEqual(reconciliation.mismatchCount, 0);
  assert.strictEqual(reconciliation.totalDelta, 0);
  assert.deepStrictEqual(reconciliation.rows[0], {
    orderId: 1001,
    date: '21/11/2026',
    customer: 'Walk-in',
    coupon: '',
    ledgerSubtotal: 100,
    ledgerDiscount: 0,
    ledgerTax: 5,
    ledgerTotal: 105,
    invoiceDiscount: 0,
    invoiceTax: 5,
    invoiceTotal: 105,
    delta: 0,
    matched: true
  });
});

test('rendered invoices do not warn when totals match the order ledger', function () {
  var items = [riceItem(100)];
  var html = invoice.render({
    id: 1001,
    date: '21/11/2026',
    customer: 'Walk-in',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: '',
    total: 105
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.match(html, /<td class="r">5%<\/td>/);
});
