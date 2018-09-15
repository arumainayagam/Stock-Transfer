


frappe.ui.form.on('Material Request', {
	onload: function (frm) {


		frm.set_query("item_code", "items", function(doc, cdt, cdn) {
			return {
				filters: {
					name: "ads"
				}
			};
		});	
	},
	refresh: function (frm) {


		if (frm.doc.material_request_type == "Material Transfer" && frm.doc.docstatus == 1) {
			var a;
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Stock Transfer",
		            filters: [
		                ["material_request", "=", frm.doc.name]
		            ],
		            limit_page_length: 1,
		            fields: ["name", "status"]		            
				},
				async: false,
				callback: function (r) {
					if (r.message) {
						console.log(r.message[0])
						a = r.message[0];
						// b - r.message
					}
				}
			});

			$(frm.fields_dict['flowboard'].wrapper).html(frappe.render_template("flow", {"a": a}));
		}
		if(frm.doc.status === "Pending" && frm.doc.docstatus == 1 && frm.doc.material_request_type == "Material Transfer" && frm.doc.owner == frappe.user.name){
			cur_frm.add_custom_button(__("Make Stock Trasnfer"), function(){
				frappe.call({
					method: 'material_w_transfer.material_warehouse_transfer.doctype.stock_transfer.stock_transfer.make_stock_transfer',
					args: {
						docname: frm.doc.name,
						items: frm.doc.items,
						from_warehouse: frm.doc.from_warehouse,
						is_serialised_item_: frm.doc.is_serialised_item_

					},
					callback: function(r) {
						console.log(r.message)
						frappe.set_route("Form", "Stock Transfer", r.message);

					}
				});
 			});
 		}		
	}
});
