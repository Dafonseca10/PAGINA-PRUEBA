document.addEventListener("DOMContentLoaded", () => {
  // Year
  document.querySelectorAll("#year").forEach(el => {
    el.textContent = new Date().getFullYear();
  });

  // Reveal on scroll
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add("isVisible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    revealEls.forEach(el => io.observe(el));
  }

  // Burger menu
  const burgerBtn = document.getElementById("burgerBtn");
  const navMenu = document.getElementById("navMenu");
  const navOverlay = document.getElementById("navOverlay");
  const hasBurger = burgerBtn && navMenu && navOverlay;

  function openMenu() {
    if (!hasBurger) return;
    burgerBtn.classList.add("isOpen");
    navMenu.classList.add("isOpen");
    navOverlay.hidden = false;
    navOverlay.classList.add("isOpen");
    burgerBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeMenu() {
    if (!hasBurger) return;
    burgerBtn.classList.remove("isOpen");
    navMenu.classList.remove("isOpen");
    navOverlay.classList.remove("isOpen");
    navOverlay.hidden = true;
    burgerBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  if (hasBurger) {
    burgerBtn.addEventListener("click", () => {
      navMenu.classList.contains("isOpen") ? closeMenu() : openMenu();
    });
    navOverlay.addEventListener("click", closeMenu);
    navMenu.addEventListener("click", (e) => {
      if (e.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenu();
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 860) closeMenu();
    });
  }

  // Active link
  const current = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav a").forEach(link => {
    if (link.getAttribute("href") === current) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });
});

