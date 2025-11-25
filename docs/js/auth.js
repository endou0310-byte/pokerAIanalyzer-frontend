export const Auth = {
  getUser() {
    try { return JSON.parse(localStorage.getItem("pa_user") || "null"); }
    catch { return null; }
  },
  setUser(u) {
    localStorage.setItem("pa_user", JSON.stringify(u));
  },
  logout() {
    localStorage.removeItem("pa_user");
    localStorage.removeItem("pa_plan");
  },
  isLoggedIn() {
    const u = this.getUser();
    return !!(u && u.user_id);
  }
};
