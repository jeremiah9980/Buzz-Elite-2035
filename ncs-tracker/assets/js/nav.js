const logoStyle = 'width:54px;height:54px;border-radius:10px;object-fit:contain;display:block;border:1px solid rgba(255,255,255,.42);box-shadow:0 0 24px rgba(229,9,20,.65);background:#020204;padding:2px;';

const NAV_HTML = `
<nav class="elite-nav">
  <div class="nav-inner">
    <a class="nav-brand" href="../index.html">
      <img class="nav-logo" style="${logoStyle}" src="../assets/img/buzz-elite-2035-logo.svg" alt="Buzz Elite 2035 logo">
      <strong>Buzz</strong> <span>ELITE 2035</span>
    </a>
    <div class="nav-links">
      <a href="../index.html#home">Home</a>
      <a href="../index.html#team-info">Team Info</a>
      <a href="../roster/">Roster</a>
      <a href="../index.html#schedule">Schedule</a>
      <a href="index.html">Tournament Tracker</a>
      <a href="../index.html#media">Media</a>
      <a href="../contact.html">Contact</a>
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
