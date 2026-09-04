const dom = {
  options: undefined,
  selectedIndex: undefined
};
try {
  console.log(dom.options[dom.selectedIndex]);
} catch (e) {
  console.log(e.toString());
}
