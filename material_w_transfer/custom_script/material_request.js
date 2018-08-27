
frappe.ui.form.on('Material Request', {
	refresh: function (frm) {
		if(frm.doc.status === "Pending" && frm.doc.docstatus == 1){
			cur_frm.add_custom_button(__("Make Stock Trasnfer"), function(){
				frappe.call({
					method: 'material_w_transfer.material_warehouse_transfer.doctype.stock_transfer.stock_transfer.make_stock_transfer',
					args: {
						docname: frm.doc.name,
						items: frm.doc.items

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
