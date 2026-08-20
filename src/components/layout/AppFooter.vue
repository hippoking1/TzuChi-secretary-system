<template>
  <footer class="app-footer">
    <div class="container text-center">
      <p class="slogan">「願人心淨化，社會祥和，天下無災無難」</p>
      <p class="copyright">佛教慈濟慈善事業基金會 © {{ new Date().getFullYear() }} 活動報名與志工系統 2.0</p>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  background: var(--gray-900);
  color: var(--gray-400);
  padding: 2.5rem 0;
  margin-top: 4rem;
  font-size: 0.9rem;
}
.slogan {
  color: var(--gray-300);
  font-size: 1.05rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}
.copyright {
  font-size: 0.8rem;
  color: var(--gray-500);
}
</style>
