import { bench, group, run } from "mitata";
import { Database } from "bun:sqlite";
import { asc, eq } from "drizzle-orm/expressions";
import { alias } from "drizzle-orm-sqlite";
import { SQLiteBunConnector } from "drizzle-orm-sqlite/bun";
import { sql } from "drizzle-orm";
import { placeholder } from "drizzle-orm/sql";
import {
  employees,
  customers,
  suppliers,
  products,
  orders,
  details,
} from "./schema";
import {
  customerIds,
  customerSearches,
  employeeIds,
  orderIds,
  productSearches,
} from "./meta";

const sqlite = new Database("northwind.db");
const db = new SQLiteBunConnector(sqlite).connect();

const d1 = db.select(customers).prepare();
const d2 = db
  .select(customers)
  .where(eq(customers.id, placeholder("userId")))
  .prepare();
const d3 = db
  .select(customers)
  .where(sql`${customers.companyName} like ${placeholder("name")}`)
  .prepare();
const d4 = db.select(employees).prepare();

const e2 = alias(employees, "recipient");
const d5 = db
  .select(employees)
  .leftJoin(e2, eq(e2.id, employees.reportsTo))
  .where(eq(employees.id, placeholder("employeeId")))
  .prepare();

const d6 = db.select(suppliers).prepare();
const d7 = db.select(products).prepare();
const d8 = db
  .select(products)
  .where(sql`${products.name} like ${placeholder("name")}`)
  .prepare();

const d9 = db
  .select(orders)
  .leftJoin(details, eq(orders.id, details.orderId))
  .leftJoin(products, eq(details.productId, products.id))
  .where(eq(orders.id, placeholder("orderId")))
  .prepare();

const d10 = db
  .select(orders)
  .fields({
    id: orders.id,
    shippedDate: orders.shippedDate,
    shipName: orders.shipName,
    shipCity: orders.shipCity,
    shipCountry: orders.shipCountry,
    productsCount: sql`count(${details.productId})`.as<number>(),
    quantitySum: sql`sum(${details.quantity})`.as<number>(),
    totalPrice:
      sql`sum(${details.quantity} * ${details.unitPrice})`.as<number>(),
  })
  .leftJoin(details, eq(orders.id, details.orderId))
  .groupBy(orders.id)
  .orderBy(asc(orders.id))
  .prepare();

group({ name: "drizzle", summary: false }, () => {
  bench("select * from customer", () => {
    d1.execute();
  });
  bench("select * from customer where id = ?", () => {
    customerIds.forEach((id) => {
      d2.execute({ userId: id });
    });
  });

  bench("select * from customer where company_name like ?", () => {
    customerSearches.forEach((it) => {
      d3.execute({ name: `%${it}%` });
    });
  });

  bench("SELECT * FROM employee", () => {
    d4.execute();
  });

  bench("select * from employee where id = ? left join reportee", () => {
    employeeIds.forEach((id) => {
      d5.execute({ employeeId: id });
    });
  });
  bench("SELECT * FROM supplier", () => {
    d6.execute();
  });

  bench("SELECT * FROM product", () => {
    d7.execute();
  });

  bench("SELECT * FROM product WHERE product.name LIKE ?", () => {
    productSearches.forEach((it) => {
      d8.execute({ name: `%${it}%` });
    });
  });

  bench(
    "SELECT * FROM order WHERE order_id = ? LEFT JOIN details and products",
    () => {
      orderIds.forEach((id) => {
        d9.execute({ orderId: id });
      });
    }
  );

  bench("select all order with sum and count", () => {
    d10.execute();
  });
});

const main = async () => {
  await run();
  process.exit(1);
};

main();
