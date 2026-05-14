// Diagnostic script for Tiptap Table Plus layout issue
// Paste this in browser console while the table is visible in the editor

console.log("=== TABLE PLUS DIAGNOSTICS ===\n");

// Find the table
const table = document.querySelector("table.table-plus");
if (!table) {
  console.error("❌ No table.table-plus found");
} else {
  console.log("✅ Found table.table-plus");

  // Get table dimensions
  console.log(`\n📏 TABLE DIMENSIONS:`);
  console.log(`  Display: ${getComputedStyle(table).display}`);
  console.log(`  Width: ${table.offsetWidth}px`);
  console.log(`  Height: ${table.offsetHeight}px`);
  console.log(
    `  BoundingRect: width=${table.getBoundingClientRect().width}, height=${table.getBoundingClientRect().height}`,
  );

  // Check rows
  const rows = table.querySelectorAll("tr");
  console.log(`\n📊 ROWS FOUND: ${rows.length}`);

  rows.forEach((row, idx) => {
    const cells = row.querySelectorAll("td, th");
    const computed = getComputedStyle(row);
    const cellPercentage = computed
      .getPropertyValue("--cell-percentage")
      .trim();

    console.log(`\n  Row ${idx + 1}:`);
    console.log(`    Display: ${computed.display}`);
    console.log(`    Grid-template-columns: ${computed.gridTemplateColumns}`);
    console.log(`    --cell-percentage: "${cellPercentage}"`);
    console.log(`    Width: ${row.offsetWidth}px`);
    console.log(`    Cell count: ${cells.length}`);

    cells.forEach((cell, cIdx) => {
      const cellComputed = getComputedStyle(cell);
      console.log(
        `      Cell ${cIdx + 1}: display=${cellComputed.display}, width=${cell.offsetWidth}px`,
      );
    });
  });

  // Check CSS variables on rows
  console.log(`\n🔍 CSS VARIABLE INSPECTION:`);
  const firstRow = rows[0];
  if (firstRow) {
    const allVars = getComputedStyle(firstRow);
    console.log(`  Properties on first row that contain 'cell':`);
    for (let i = 0; i < allVars.length; i++) {
      const prop = allVars[i];
      if (prop.includes("cell")) {
        console.log(`    ${prop}: ${allVars.getPropertyValue(prop)}`);
      }
    }
  }

  // Check parent wrapper
  console.log(`\n📦 WRAPPER INSPECTION:`);
  const wrapper = table.closest('div[style*="position: relative"]');
  if (wrapper) {
    console.log(`  Found wrapper div with position: relative`);
    console.log(`  Display: ${getComputedStyle(wrapper).display}`);
    console.log(`  Width: ${wrapper.offsetWidth}px`);
  } else {
    console.log(`  ⚠️ No wrapper with position:relative found`);
  }

  // Check tbody
  console.log(`\n🔗 TBODY & TABLE STRUCTURE:`);
  const tbody = table.querySelector("tbody");
  if (tbody) {
    console.log(`  Found tbody`);
    console.log(`  Display: ${getComputedStyle(tbody).display}`);
    console.log(`  Width: ${tbody.offsetWidth}px`);
  } else {
    console.log(`  ⚠️ No tbody found`);
  }

  // Check for .table-row-group
  const rowGroup = table.closest(".table-row-group");
  if (rowGroup) {
    console.log(`  Found .table-row-group`);
    console.log(`  Display: ${getComputedStyle(rowGroup).display}`);
  } else {
    console.log(`  ⚠️ No .table-row-group found`);
  }
}

console.log("\n=== END DIAGNOSTICS ===");
