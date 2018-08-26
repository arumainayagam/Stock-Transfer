from __future__ import unicode_literals
from frappe import _

def get_data():
	return [
		{
			"label": _("Stock Transfer"),
			"icon": "fa fa-star",
			"items": [
				{
					"type": "doctype",
					"name": "Stock Transfer",
					"description": _("Stock Transfer"),
				},
			]
		}
	]
