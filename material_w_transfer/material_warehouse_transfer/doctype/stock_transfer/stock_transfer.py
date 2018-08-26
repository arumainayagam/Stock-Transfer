# -*- coding: utf-8 -*-
# Copyright (c) 2018, Crisco Consulting and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
import frappe, erpnext, json
from frappe.model.document import Document
class StockTransfer(Document):
	pass


@frappe.whitelist()
def get_request_details(docname):

	items = frappe.db.get_list("Material Request Item", 
	fields= ["item_code", "item_name", "description", "qty",
			 "stock_uom", "warehouse", "schedule_date", "uom", 
			 "conversion_factor", "stock_qty"],
	filters={"parent": docname})

	return items


@frappe.whitelist()
def recieve_stock_transfer(items, from_w, material_request):
	transit_ware = frappe.db.get_list("Warehouse", 
	fields= ["name"],
	filters={"default_transit": 1})[0]
	if not transit_ware:
		frappe.throw(_("Please Set Transit Warehouse To Proceed"))
			
	args = json.loads(items)

	stock_entry = frappe.new_doc("Stock Entry")
	stock_entry.purpose = "Material Transfer"
	for x in args:
		if not x["t_warehouse"]:
			tot = from_w
		elif x["t_warehouse"]:
			tot = x["t_warehouse"]
		stock_entry.append("items", {
		"s_warehouse": transit_ware,
		"t_warehouse": tot,
		"item_code": x["item_code"],
		"qty": x["qty"],
		"description": x["description"],
		"conversion_factor": x["conversion_factor"],
		"stock_uom": x["stock_uom"],
		"transfer_qty": x["transfer_qty"],
		"serial_no": x["serial_no"],
		"uom": x["uom"]
		})
	stock_entry.insert()
	stock_entry.submit()
	frappe.db.set_value("Material Request", material_request, 'status', "Transferred")
	frappe.db.set_value("Material Request", material_request, 'per_ordered', 100)

	return {"name": stock_entry.name}		


@frappe.whitelist()
def send_stock_transfer(items, from_w, material_request):
	transit_ware = frappe.db.get_list("Warehouse", 
	fields= ["name"],
	filters={"default_transit": 1})[0]
	if not transit_ware:
		frappe.throw(_("Please Set Transit Warehouse To Proceed"))	

	args = json.loads(items)
	stock_entry = frappe.new_doc("Stock Entry")
	stock_entry.purpose = "Material Transfer"
	for x in args:
		if not x["s_warehouse"]:
			tot = from_w
		elif x["s_warehouse"]:
			tot = x["s_warehouse"]
		stock_entry.append("items", {
		"s_warehouse": tot,
		"t_warehouse": transit_ware,
		"item_code": x["item_code"],
		"qty": x["qty"],
		"description": x["description"],
		"conversion_factor": x["conversion_factor"],
		"stock_uom": x["stock_uom"],
		"transfer_qty": x["transfer_qty"],
		"serial_no": x["serial_no"],
		"uom": x["uom"]
		})

	stock_entry.insert()
	stock_entry.submit()
	frappe.db.set_value("Material Request", material_request, 'status', "Issued")
	frappe.db.set_value("Material Request", material_request, 'per_ordered', 50)

	return {"name": stock_entry.name}		

		