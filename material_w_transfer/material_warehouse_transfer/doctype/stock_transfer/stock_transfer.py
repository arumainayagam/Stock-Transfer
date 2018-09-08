# -*- coding: utf-8 -*-
# Copyright (c) 2018, Crisco Consulting and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
import frappe, erpnext, json
from frappe.model.document import Document
from frappe.utils import cstr, cint, flt, comma_or, getdate, nowdate, formatdate, format_time
from erpnext.stock.utils import get_incoming_rate
from erpnext.stock.stock_ledger import get_previous_sle, NegativeStockError, get_valuation_rate
from erpnext.stock.get_item_details import get_bin_details, get_default_cost_center, get_conversion_factor
from erpnext.stock.doctype.batch.batch import get_batch_no, set_batch_nos, get_batch_qty
from erpnext.manufacturing.doctype.bom.bom import validate_bom_no
from erpnext.stock.utils import get_bin
class StockTransfer(Document):
	pass
	def validate(self):
		for d in self.get('items'):
			d.s_warehouse = self.from_warehouse
			d.t_warehouse = self.to_warehouse
			
	def get_item_details(self, args=None, for_update=False):
		item = frappe.db.sql("""select stock_uom, description, image, item_name,
				expense_account, buying_cost_center, item_group, has_serial_no,
				has_batch_no, sample_quantity
			from `tabItem`
			where name = %s
				and disabled=0
				and (end_of_life is null or end_of_life='0000-00-00' or end_of_life > %s)""",
			(args.get('item_code'), nowdate()), as_dict = 1)
		if not item:
			frappe.throw(_("Item {0} is not active or end of life has been reached").format(args.get("item_code")))

		item = item[0]

		ret = frappe._dict({
			'uom'			      	: item.stock_uom,
			'stock_uom'			  	: item.stock_uom,
			'description'		  	: item.description,
			'image'					: item.image,
			'item_name' 		  	: item.item_name,
			'expense_account'		: args.get("expense_account"),
			'cost_center'			: get_default_cost_center(args, item),
			'qty'					: 0,
			'transfer_qty'			: 0,
			'conversion_factor'		: 1,
			'batch_no'				: '',
			'actual_qty'			: 0,
			'basic_rate'			: 0,
			'serial_no'				: '',
			'has_serial_no'			: item.has_serial_no,
			'has_batch_no'			: item.has_batch_no,
			'sample_quantity'		: item.sample_quantity
		})

		return ret

@frappe.whitelist()
def make_stock_transfer(docname, items, from_warehouse):
	frappe.db.set_value("Material Request", docname, 'status', "Ordered")
	frappe.db.set_value("Material Request", docname, 'per_ordered', 25)
	args = json.loads(items)
	stock_entry = frappe.new_doc("Stock Transfer")
	stock_entry.material_request = docname
	stock_entry.from_warehouse = from_warehouse
	

	if all(c["warehouse"] == args[0]["warehouse"] for c in args):
		stock_entry.to_warehouse = args[0]["warehouse"]

	for x in args:
		stock_entry.append("items", {
		"t_warehouse": x["warehouse"],
		"item_code": x["item_code"],
		"qty": x["qty"],
		"description": x["description"],
		"conversion_factor": x["conversion_factor"],
		"stock_uom": x["stock_uom"],
		"transfer_qty": x["qty"]*x["conversion_factor"],
		"uom": x["uom"]
		})
	stock_entry.insert()
	

	return stock_entry.name


@frappe.whitelist()
def get_request_details(docname):

	items = frappe.db.get_list("Material Request Item", 
	fields= ["item_code", "item_name", "description", "qty",
			 "stock_uom", "warehouse", "schedule_date", "uom", 
			 "conversion_factor", "stock_qty"],
	filters={"parent": docname})

	return items


@frappe.whitelist()
def recieve_stock_transfer(items, from_w, material_request=None, docname=None):
	transit_ware = frappe.db.get_list("Warehouse", 
	fields= ["name"],
	filters={"default_transit": 1})[0].name
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

	frappe.db.set_value("Stock Transfer", docname, 'status', "Recieved")
	
	if material_request:
		frappe.db.set_value("Material Request", material_request, 'status', "Transferred")
		frappe.db.set_value("Material Request", material_request, 'per_ordered', 100)

	return {"name": stock_entry.name}		


@frappe.whitelist()
def send_stock_transfer(items, from_w, material_request=None, docname=None):
	transit_ware = frappe.db.get_list("Warehouse", 
	fields= ["name"],
	filters={"default_transit": 1})[0].name
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

	frappe.db.set_value("Stock Transfer", docname, 'status', "Sent")
	
	if material_request:
		frappe.db.set_value("Material Request", material_request, 'status', "Issued")
		frappe.db.set_value("Material Request", material_request, 'per_ordered', 50)

	return {"name": stock_entry.name}		

