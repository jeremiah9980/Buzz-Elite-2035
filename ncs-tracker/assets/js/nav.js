const logoStyle = 'width:42px;height:42px;border-radius:50%;object-fit:contain;display:block;border:2px solid #F59E0B;box-shadow:0 0 18px rgba(245,158,11,.45);background:#060608;';

const NAV_HTML = `
<nav>
  <div class="nav-inner">
    <a class="nav-brand" href="../index.html">
      <img class="nav-logo" style="${logoStyle}" src="../assets/img/buzz-fastpitch-logo.svg" alt="Buzz Fastpitch logo">
      Buzz <span>FASTPITCH</span>
    </a>
    <div class="nav-links">
      <a href="../index.html">Home</a>
      <a href="../index.html#team-info">Team Info</a>
      <a href="../roster/">Roster</a>
      <a href="../index.html#schedule">Schedule</a>
      <a href="index.html">NCS Tracker</a>
      <a href="../fundraising.html">Fundraising</a>
    </div>
  </div>
</nav>`;

document.addEventListener('DOMContentLoaded', () => {
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (path.endsWith(a.getAttribute('href').split('/').pop())) a.classList.add('active');
  });
});