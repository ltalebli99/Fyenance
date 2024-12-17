import { formatCurrency } from '../utils/formatters.js';

export async function updateBannerData() {
  try {
    // Get net worth
    const { data: netWorth } = await window.databaseApi.getNetWorth();
    console.log('Net Worth:', netWorth);
    document.getElementById('total-net-worth').textContent = formatCurrency(netWorth || 0);

    // Get monthly comparison
    const { data: monthlyComparison } = await window.databaseApi.getMonthlyComparison();
    console.log('Monthly Comparison:', monthlyComparison);
    
    if (monthlyComparison && typeof monthlyComparison.percentChange === 'number') {
      const trendText = monthlyComparison.trend === 'lower' ? 'lower' : 'higher';
      document.getElementById('monthly-trend').textContent = 
        `Your spending is ${Math.abs(monthlyComparison.percentChange).toFixed(1)}% ${trendText} than last month`;
    } else {
      document.getElementById('monthly-trend').textContent = 
        'No spending comparison available yet';
    }

    // Get upcoming payments
    const { data: upcomingCount } = await window.databaseApi.getUpcomingPayments();
    console.log('Upcoming Payments:', upcomingCount);
    
    if (typeof upcomingCount === 'number') {
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