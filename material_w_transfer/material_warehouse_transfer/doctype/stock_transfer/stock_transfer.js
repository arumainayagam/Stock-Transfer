// Copyright (c) 2018, Crisco Consulting and contributors
// For license information, please see license.txt


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
 			});
 		}		    

	},
	material_request: function (frm) {
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
	},
	from_warehouse: function (frm) {

		$.each(frm.doc.items || [], function(i, jvd) {
			frappe.model.set_value(jvd.doctype, jvd.name, "s_warehouse", frm.doc.from_warehouse);
		});
	}
});
