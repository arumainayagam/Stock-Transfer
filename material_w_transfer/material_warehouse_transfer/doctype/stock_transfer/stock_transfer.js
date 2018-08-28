// Copyright (c) 2018, Crisco Consulting and contributors
// For license information, please see license.txt


frappe.provide("erpnext.stock");

frappe.ui.form.on('Stock Transfer', {
	refresh: function(frm) {
	    cur_frm.set_query("material_request", function() {
	        return {
	            "filters": {
	                "material_request_type": "Material Transfer",
	                "status": "Pending"
	            }
	        };
	    });

		if(frm.doc.status === "Sent"){
			cur_frm.add_custom_button(__("Recieve"), function(){
				frappe.call({
					method: 'material_w_transfer.material_warehouse_transfer.doctype.stock_transfer.stock_transfer.recieve_stock_transfer',
					args: {
						from_w: frm.doc.from_warehouse,
						items: frm.doc.items,
						material_request: frm.doc.material_request,

					},
					callback: function(r) {
						console.log(r.message)
						frappe.msgprint("Succesfully Recieved")
						frm.set_value("status", "Recieved")
						cur_frm.save();

					}
				});
 			});
 		}	
 		if(frm.doc.status === "Pending" && !frm.doc.__islocal){
			cur_frm.add_custom_button(__("Send"), function(){
				if (frm.doc.from_warehouse && frm.doc.to_warehouse) {
				frappe.call({
					method: 'material_w_transfer.material_warehouse_transfer.doctype.stock_transfer.stock_transfer.send_stock_transfer',
					args: {
						items: frm.doc.items,
						from_w: frm.doc.from_warehouse,
						material_request: frm.doc.material_request,

					},
					callback: function(r) {
						console.log(r.message)
						frappe.msgprint("Succesfully Sent")
						frm.set_value("status", "Sent")
						cur_frm.save();

					}
				});
			}
			else if(!frm.doc.from_warehouse && !frm.doc.to_warehouse){
				frappe.throw(__("Please select default From Warehouse and To Warehouse"));
			}
 			});
 		}		    

	},
	material_request: function (frm) {
		if (frm.doc.material_request) {
			frappe.call({
				method: "material_w_transfer.material_warehouse_transfer.doctype.stock_transfer.stock_transfer.get_request_details",
				args:{
					docname: frm.doc.material_request
				},
				callback: function (r) {
					if (r.message) {
						console.log(r.message)

						for (var i = 0; i < r.message.length; i++) {
							var row = frappe.model.add_child(cur_frm.doc, "Stock Entry Detail", "items"); 
							row.item_code = r.message[i].item_code;
							row.qty = r.message[i].qty;
							row.uom = r.message[i].uom;
							row.description = r.message[i].description;
							row.t_warehouse = r.message[i].warehouse;
							row.conversion_factor = r.message[i].conversion_factor;
							row.s_warehouse = frm.doc.from_warehouse;
							row.transfer_qty = r.message[i].qty;

						}
						frm.refresh_field("items");


					}
				}
			});
		}
	},
	from_warehouse: function (frm) {

		$.each(frm.doc.items || [], function(i, jvd) {
			frappe.model.set_value(jvd.doctype, jvd.name, "s_warehouse", frm.doc.from_warehouse);
		});
	},

	set_serial_no: function(frm, cdt, cdn, callback) {
		var d = frappe.model.get_doc(cdt, cdn);
		if(!d.item_code && !d.s_warehouse && !d.qty) return;
		var	args = {
			'item_code'	: d.item_code,
			'warehouse'	: cstr(d.s_warehouse),
			'stock_qty'		: d.transfer_qty
		};
		frappe.call({
			method: "erpnext.stock.get_item_details.get_serial_no",
			args: {"args": args},
			callback: function(r) {
				if (!r.exe){
					frappe.model.set_value(cdt, cdn, "serial_no", r.message);
				}

				if (callback) {
					callback();
				}
			}
		});
	},	

	set_basic_rate: function(frm, cdt, cdn) {
		const item = locals[cdt][cdn];
		item.transfer_qty = flt(item.qty) * flt(item.conversion_factor);

		const args = {
			'item_code'			: item.item_code,
			'posting_date'		: frm.doc.posting_date,
			'posting_time'		: frm.doc.posting_time,
			'warehouse'			: cstr(item.s_warehouse) || cstr(item.t_warehouse),
			'serial_no'			: item.serial_no,
			'company'			: frm.doc.company,
			'qty'				: item.s_warehouse ? -1*flt(item.transfer_qty) : flt(item.transfer_qty),
			'voucher_type'		: frm.doc.doctype,
			'voucher_no'		: item.name,
			'allow_zero_valuation': 1,
		};

		if (item.item_code || item.serial_no) {
			frappe.call({
				method: "erpnext.stock.utils.get_incoming_rate",
				args: {
					args: args
				},
				callback: function(r) {
					frappe.model.set_value(cdt, cdn, 'basic_rate', (r.message || 0.0));
					frm.events.calculate_basic_amount(frm, item);
				}
			});
		}
	},
	get_warehouse_details: function(frm, cdt, cdn) {
		var child = locals[cdt][cdn];
		if(!child.bom_no) {
			frappe.call({
				method: "erpnext.stock.doctype.stock_entry.stock_entry.get_warehouse_details",
				args: {
					"args": {
						'item_code': child.item_code,
						'warehouse': cstr(child.s_warehouse) || cstr(child.t_warehouse),
						'transfer_qty': child.transfer_qty,
						'serial_no': child.serial_no,
						'qty': child.s_warehouse ? -1* child.transfer_qty : child.transfer_qty,
						'posting_date': frm.doc.posting_date,
						'posting_time': frm.doc.posting_time,
						'company': frm.doc.company,
						'voucher_type': frm.doc.doctype,
						'voucher_no': child.name,
						'allow_zero_valuation': 1
					}
				},
				callback: function(r) {
					if (!r.exc) {
						$.extend(child, r.message);
						frm.events.calculate_basic_amount(frm, child);
					}
				}
			});
		}
	},
	calculate_basic_amount: function(frm, item) {
		item.basic_amount = flt(flt(item.transfer_qty) * flt(item.basic_rate),
			precision("basic_amount", item));

		frm.events.calculate_amount(frm);
	},

	calculate_amount: function(frm) {
		// frm.events.calculate_total_additional_costs(frm);

		const total_basic_amount = frappe.utils.sum(
			(frm.doc.items || []).map(function(i) { return i.t_warehouse ? flt(i.basic_amount) : 0; })
		);

		for (let i in frm.doc.items) {
			let item = frm.doc.items[i];

			if (item.t_warehouse && total_basic_amount) {
				item.additional_cost = (flt(item.basic_amount) / total_basic_amount) * frm.doc.total_additional_costs;
			} else {
				item.additional_cost = 0;
			}

			item.amount = flt(item.basic_amount + flt(item.additional_cost),
				precision("amount", item));

			item.valuation_rate = flt(flt(item.basic_rate)
				+ (flt(item.additional_cost) / flt(item.transfer_qty)),
				precision("valuation_rate", item));
		}

		refresh_field('items');
	},

	calculate_total_additional_costs: function(frm) {
		const total_additional_costs = frappe.utils.sum(
			(frm.doc.additional_costs || []).map(function(c) { return flt(c.amount); })
		);

		frm.set_value("total_additional_costs",
			flt(total_additional_costs, precision("total_additional_costs")));
	},

});




frappe.ui.form.on('Stock Entry Detail', {
	qty: function(frm, cdt, cdn) {
		frm.events.set_serial_no(frm, cdt, cdn, () => {
			frm.events.set_basic_rate(frm, cdt, cdn);
		});
	},

	conversion_factor: function(frm, cdt, cdn) {
		frm.events.set_basic_rate(frm, cdt, cdn);
	},

	s_warehouse: function(frm, cdt, cdn) {
		frm.events.set_serial_no(frm, cdt, cdn, () => {
			frm.events.get_warehouse_details(frm, cdt, cdn);
		});
	},

	t_warehouse: function(frm, cdt, cdn) {
		frm.events.get_warehouse_details(frm, cdt, cdn);
	},

	basic_rate: function(frm, cdt, cdn) {
		var item = locals[cdt][cdn];
		frm.events.calculate_basic_amount(frm, item);
	},

	barcode: function(doc, cdt, cdn) {
		var d = locals[cdt][cdn];
		if (d.barcode) {
			frappe.call({
				method: "erpnext.stock.get_item_details.get_item_code",
				args: {"barcode": d.barcode },
				callback: function(r) {
					if (!r.exe){
						frappe.model.set_value(cdt, cdn, "item_code", r.message);
					}
				}
			});
		}
	},

	uom: function(doc, cdt, cdn) {
		var d = locals[cdt][cdn];
		if(d.uom && d.item_code){
			return frappe.call({
				method: "erpnext.stock.doctype.stock_entry.stock_entry.get_uom_details",
				args: {
					item_code: d.item_code,
					uom: d.uom,
					qty: d.qty
				},
				callback: function(r) {
					if(r.message) {
						frappe.model.set_value(cdt, cdn, r.message);
					}
				}
			});
		}
	},
	item_code: function(frm, cdt, cdn) {
		var d = locals[cdt][cdn];
		if(d.item_code) {
			var args = {
				'item_code'			: d.item_code,
				'warehouse'			: cstr(d.s_warehouse) || cstr(d.t_warehouse),
				'transfer_qty'		: d.transfer_qty,
				'serial_no'		: d.serial_no,
				'bom_no'		: d.bom_no,
				'expense_account'	: d.expense_account,
				'cost_center'		: d.cost_center,
				'company'		: frm.doc.company,
				'qty'			: d.qty,
				'voucher_type'		: frm.doc.doctype,
				'voucher_no'		: d.name,
				'allow_zero_valuation': 1,
			};
			return frappe.call({
				doc: frm.doc,
				method: "get_item_details",
				args: args,
				callback: function(r) {
					if(r.message) {
						var d = locals[cdt][cdn];
						$.each(r.message, function(k, v) {
							d[k] = v;
						});
						refresh_field("items");
						erpnext.stock.select_batch_and_serial_no(frm, d);
					}
				}
			});
		}		
	}
});
erpnext.stock.select_batch_and_serial_no = (frm, item) => {
	let get_warehouse_type_and_name = (item) => {
		let value = '';
		if(frm.fields_dict.from_warehouse.disp_status === "Write") {
			value = cstr(item.s_warehouse) || '';
			return {
				type: 'Source Warehouse',
				name: value
			};
		} else {
			value = cstr(item.t_warehouse) || '';
			return {
				type: 'Target Warehouse',
				name: value
			};
		}
	}

	if(item && item.has_serial_no
		&& frm.doc.purpose === 'Material Receipt') {
		return;
	}

	frappe.require("assets/erpnext/js/utils/serial_no_batch_selector.js", function() {
		new erpnext.SerialNoBatchSelector({
			frm: frm,
			item: item,
			warehouse_details: get_warehouse_type_and_name(item),
		});
	});

}


