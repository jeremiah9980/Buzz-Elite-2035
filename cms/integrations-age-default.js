(() => {
  if (typeof state === "undefined" || !state?.ncs) return;
  const divisionInput = document.querySelector("#ncsDivision");
  if (divisionInput) {
    divisionInput.value = state.ncs.division || "";
    divisionInput.placeholder = "Any age";
  }
})();
