import { test, expect } from "@playwright/test";
test("real PostgreSQL API returns catalog and rejects malformed details", async ({
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  expect((await health.json()).total).toBe(3223);
  const catalog = await request.get("/api/catalog");
  const data = await catalog.json();
  expect(data.areas).toHaveLength(14);
  expect(data.occupations).toHaveLength(3223);
  const detail = await request.get("/api/occupations/212405");
  expect((await detail.json()).activities.length).toBeGreaterThan(5);
  expect((await request.get("/api/occupations/invalid")).status()).toBe(400);
  expect((await request.get("/api/occupations/999998")).status()).toBe(404);
});
test("map, search, salary range, save, comparison and guide work without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("3.223", { exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Comparar caminhos" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Aumentar zoom" }).click();
  await page.waitForTimeout(450);
  await expect(page.locator(".map-controls")).toContainText("145%");
  await page.getByRole("button", { name: "Ajustar mapa à tela" }).click();
  await expect(page.locator(".map-controls")).toContainText("100%");
  await page.screenshot({
    path: "test-results/desktop-map.png",
    fullPage: true,
  });
  // Regress the pointer-release race: a queued pan update must not read a cleared drag ref.
  const canvasBox = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(canvasBox.x + 100, canvasBox.y + 150);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 260, canvasBox.y + 190, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Ajustar mapa à tela" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.getByRole("searchbox").fill("youtuber");
  await expect(page.locator(".career-card")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: /Caminho empreendedor Criador de conteúdo no YouTube/,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sem estimativa confiável" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Salvar caminho", exact: true })
    .click();
  await page.getByRole("button", { name: "Comparar", exact: true }).click();
  await page
    .getByRole("button", { name: "Fechar detalhes", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  const compareButton = page.getByRole("button", { name: "Comparar caminhos" });
  await expect(compareButton).toBeVisible();
  await expect(compareButton.locator("b")).toHaveText("1");
  await expect(page.locator(".map-instruction")).toHaveCount(0);
  const compareBox = (await compareButton.boundingBox())!;
  expect(
    Math.abs(
      compareBox.x + compareBox.width / 2 - page.viewportSize()!.width / 2,
    ),
  ).toBeLessThan(2);
  expect(
    page.viewportSize()!.height - compareBox.y - compareBox.height,
  ).toBeCloseTo(66, 0);
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await page.getByRole("searchbox").fill("Fundador de SaaS");
  await expect(page.locator(".career-card")).toHaveCount(1);
  await page.locator(".card-main").click();
  await page.getByRole("button", { name: "Comparar", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Comparar caminhos" }).click();
  await expect(page.getByRole("dialog")).toContainText("Fundador de SaaS");
  await expect(page.getByRole("dialog")).toContainText("YouTube");
  await page.keyboard.press("Escape");
  await page.getByRole("searchbox").fill("");
  await page.getByLabel("Salário mínimo", { exact: true }).fill("5000");
  await page.getByLabel("Salário máximo", { exact: true }).fill("");
  await page
    .getByLabel("Salário máximo", { exact: true })
    .pressSequentially("8000");
  await expect(page.getByLabel("Salário máximo", { exact: true })).toHaveValue(
    "8000",
  );
  await expect(
    page.getByLabel("Incluir opções sem dados de salário"),
  ).not.toBeChecked();
  await expect(page.locator(".career-card")).not.toHaveCount(0);
  const salaries = await page.locator(".card-salary strong").allTextContents();
  for (const s of salaries) {
    const n = Number(s.replace(/\D/g, ""));
    expect(n).toBeGreaterThanOrEqual(5000);
    expect(n).toBeLessThanOrEqual(8000);
  }
  await page.getByRole("searchbox").fill("zzzzinexistente");
  await expect(
    page.getByText("Nenhum caminho com essa combinação."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explorar todas as possibilidades" })
    .click();
  await page.getByRole("button", { name: /Não sei por onde começar/ }).click();
  await page.getByRole("button", { name: /Criar & expressar/ }).click();
  await page.getByRole("button", { name: "Encontrar possibilidades" }).click();
  await expect(
    page.getByRole("button", { name: "A Artístico", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Salvos/ }).click();
  await expect(page.locator(".career-card")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: /Salvos/ }).click();
  await expect(page.locator(".career-card")).toHaveCount(1);
  expect(errors).toEqual([]);
});
test("area filter removes other areas; URLs restore filters", async ({
  page,
}) => {
  await page.goto(
    "/?areas=tecnologia&remote=alto&min=4000&max=15000&unknown=0",
  );
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "Abrir filtros" }).click();
  await expect(
    page.getByLabel("Tecnologia", { exact: false }).first(),
  ).toBeChecked();
  await expect(page.getByLabel("Potencial de trabalho remoto")).toHaveValue(
    "alto",
  );
  await page
    .getByLabel("Filtros de carreiras")
    .getByRole("button", { name: "Fechar filtros", exact: true })
    .click();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.locator(".career-card").first()).toBeVisible();
  for (const text of await page.locator(".card-top>span").allTextContents())
    expect(text).toContain("Tecnologia");
  await page.screenshot({
    path: "test-results/filtered-list.png",
    fullPage: true,
  });
});
test("mobile has no horizontal overflow and filters can be applied", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const session = await page.context().newCDPSession(page);
  const beforePinch = await page.locator(".map-controls").textContent();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: 140, y: 400, id: 1 },
      { x: 220, y: 400, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: 100, y: 400, id: 1 },
      { x: 270, y: 400, id: 2 },
    ],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".map-controls")).not.toHaveText(beforePinch!);
  await page.getByRole("button", { name: "Abrir filtros" }).click();
  await page.getByLabel("Atividade MEI", { exact: true }).check();
  await page.getByRole("button", { name: "Ver 471 opções" }).click();
  await expect(page.getByText("471", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/mobile-map.png",
    fullPage: true,
  });
  await page.goto("/sobre");
  await expect(
    page.getByRole("heading", { name: /Um mapa amplo/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("floating filters toggle while the map stays interactive", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.locator(".filter-trigger");
  const panel = page.getByLabel("Filtros de carreiras");
  await expect(page.locator("canvas")).toBeVisible();
  await trigger.click();
  await expect(panel).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const area = page.getByRole("button", {
    name: "Aproximar área Tecnologia",
    exact: true,
  });
  const before = (await area.boundingBox())!;
  await page.mouse.move(950, 800);
  await page.mouse.down();
  await page.mouse.move(1080, 810, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await area.boundingBox())!.x)
    .toBeGreaterThan(before.x + 100);
  const zoom = await page.locator(".map-controls").textContent();
  await page.mouse.wheel(0, -500);
  await expect(page.locator(".map-controls")).not.toHaveText(zoom!);
  await expect(panel).toBeVisible();

  await page.getByLabel("Tecnologia", { exact: false }).first().check();
  await expect(page.locator("canvas")).not.toHaveAttribute(
    "data-node-count",
    "3223",
  );
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: /^Ver .* opções$/ }).focus();
  await page.keyboard.press("Tab");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(panel).not.toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await expect(panel).toBeVisible();
  const box = (await panel.boundingBox())!;
  expect(box.y).toBeGreaterThan(
    (await trigger.boundingBox())!.y + (await trigger.boundingBox())!.height,
  );
  expect(box.y + box.height).toBeLessThan(750);
  await trigger.click();
  await expect(panel).not.toBeVisible();
});
test("full-window map keeps every circle and area navigation never sets a filter", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  await expect(canvas).toHaveAttribute("data-visible-nodes", "3223");
  await expect(canvas).toHaveAttribute("data-external-labels", "0");
  const box = (await canvas.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(
    (box.width * box.height) / (viewport.width * viewport.height),
  ).toBeGreaterThan(0.9);
  await expect(page.getByText("O que o futuro pode ter a ver com")).toHaveCount(
    0,
  );
  await expect(page.getByLabel("Filtros de carreiras")).not.toBeVisible();
  await expect(page.locator(".map-instruction")).toBeVisible();
  await page
    .getByRole("button", { name: "Aproximar área Educação", exact: true })
    .click();
  await page.waitForTimeout(420);
  await expect(canvas).toHaveAttribute("data-node-count", "3223");
  expect(Number(await canvas.getAttribute("data-node-labels"))).toBeGreaterThan(
    20,
  );
  await expect(page.locator(".map-tooltip")).toHaveCount(0);
  await expect(page.locator(".map-instruction")).toHaveCount(0);
  await expect(page.locator(".results-bar")).toContainText("3.223");
  expect(new URL(page.url()).searchParams.has("areas")).toBeFalsy();
  await expect(page.locator(".map-controls")).not.toContainText("100%");
  await page.getByRole("button", { name: "Ajustar mapa à tela" }).click();
  await expect(canvas).toHaveAttribute("data-visible-nodes", "3223");
  await expect(page.locator(".map-instruction")).toHaveCount(0);
});
test("social work discovery combines salary and preparation; detail attributes its historical source", async ({
  page,
}) => {
  await page.goto(
    "/?interests=S&min=3000&max=7000&unknown=0&preparation=fundamental,medio,tecnica",
  );
  await expect(page.locator(".results-bar")).toContainText("21");
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  await expect(page.locator(".career-card")).toHaveCount(21);
  await page.locator(".card-main").first().click();
  const source = page.getByRole("link", { name: /Fonte: CBO \/ MTE/ });
  await expect(source).toContainText("2014");
  await expect(source).toHaveAttribute(
    "href",
    /gov.br.*cboconsultas-instalador.jar/,
  );
  await expect(page.getByRole("dialog")).toContainText(
    "referência descreve uma família ocupacional",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Ensino médio", { exact: true })).toBeChecked();
});
test("theme icon persists preference; list pins filters; direct controls navigate", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  const theme = page.getByRole("button", { name: "Ativar tema escuro" });
  expect(await theme.textContent()).toBe("");
  for (const name of ["Abrir filtros", "Salvos", "Não sei por onde começar"])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  const sources = page
    .locator(".results-bar")
    .getByRole("link", { name: "Fontes e metodologia" });
  await expect(sources).toHaveAttribute("href", "/sobre");
  await theme.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("canvas")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Aproximar área Educação", exact: true })
    .click();
  await page.waitForTimeout(420);
  const labels = await page.locator("canvas").getAttribute("data-node-labels");
  const zoom = await page.locator(".map-controls").textContent();
  await page.mouse.move(640, 420);
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-node-labels",
    labels!,
  );
  await expect(page.locator("canvas")).toHaveAttribute(
    "data-external-labels",
    "0",
  );
  await page.screenshot({ path: "test-results/dark-map-labels.png" });
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await expect(page.locator(".map-controls")).toHaveText(zoom!);
  await page.getByRole("button", { name: "Ativar tema escuro" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ativar tema claro" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lista", exact: true }).click();
  const sidebar = page.getByLabel("Filtros de carreiras");
  await expect(sidebar).toBeVisible();
  const side = (await sidebar.boundingBox())!;
  const workspace = (await page.locator(".workspace").boundingBox())!;
  expect(side.x).toBe(0);
  expect(workspace.x).toBeGreaterThanOrEqual(side.x + side.width);
  await expect(page.locator(".filter-backdrop")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Abrir filtros" }),
  ).not.toBeVisible();
  expect(
    await page
      .getByRole("button", { name: "A Artístico", exact: true })
      .evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe("rgb(255, 255, 255)");
  await page.screenshot({ path: "test-results/dark-list.png" });
  await page.locator(".list-view").evaluate((e) => (e.scrollTop = 350));
  expect((await sidebar.boundingBox())!.y).toBe(side.y);
  await expect(page.locator(".brand, .search-box kbd")).toHaveCount(0);
  await page.getByRole("button", { name: "Mapa", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByLabel("Filtros de carreiras")).not.toBeVisible();
  await page.getByRole("button", { name: "Ativar tema claro" }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Ativar tema escuro" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
