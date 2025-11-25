export const Storage = {
  getUser() {
    const s = localStorage.getItem("pa_user");
    return s ? JSON.parse(s) : null;
  },
  setUser(u) {
    localStorage.setItem("pa_user", JSON.stringify(u));
  },
  getPlan() {
    const s = localStorage.getItem("pa_plan");
    return s ? JSON.parse(s) : null;
  },
  setPlan(p) {
    localStorage.setItem("pa_plan", JSON.stringify(p));
  },
  clearAll() {
    localStorage.removeItem("pa_user");
    localStorage.removeItem("pa_plan");
  }
};
