(() => {
  if (typeof state === "undefined" || !state?.ncs) return;

  if (!("ageId" in state.ncs)) {
    state.ncs.ageId = "";
  }

  if (state.ncs.division === "12U" && !state.ncs.ageDefaultMigrated) {
    state.ncs.division = "";
    state.ncs.ageDefaultMigrated = true;
    localStorage.setItem(KEY, JSON.stringify(state, null, 2));
  }

  const divisionInput = document.querySelector("#ncsDivision");
  if (divisionInput) {
    divisionInput.value = state.ncs.division || "";
    divisionInput.placeholder = "Any age";
  }
})();
