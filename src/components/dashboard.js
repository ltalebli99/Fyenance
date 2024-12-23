import { formatCurrency } from '../utils/formatters.js';

export async function updateBannerData(accountId = 'all') {
  try {
    // Get net worth for specific account(s)
    const { data: netWorth } = await window.databaseApi.getNetWorth(accountId);
    document.getElementById('total-net-worth').textContent = formatCurrency(netWorth || 0);

    // Get monthly comparison for specific account(s)
    const { data: monthlyComparison } = await window.databaseApi.getMonthlyComparison(accountId);
    
    if (monthlyComparison && typeof monthlyComparison.percentChange === 'number') {
      const trendText = monthlyComparison.trend === 'lower' ? 'lower' : 'higher';
      document.getElementById('monthly-trend').textContent = 
        `Your spending is ${Math.abs(monthlyComparison.percentChange).toFixed(1)}% ${trendText} than last month`;
    } else {
      document.getElementById('monthly-trend').textContent = 
        'No spending comparison available yet';
    }

    // Get upcoming payments for specific account(s)
    const { data: upcomingCount } = await window.databaseApi.getUpcomingPayments(accountId);
    
    if (upcomingCount > 0) {
      const paymentText = upcomingCount === 1 ? 'payment' : 'payments';
      document.getElementById('upcoming-payments').textContent = 
        `${upcomingCount} recurring ${paymentText} due this week`;
    } else {
      document.getElementById('upcoming-payments').textContent = 
        'No upcoming payments this week';
    }

  } catch (error) {
    console.error('Error updating banner data:', error);
  }
}