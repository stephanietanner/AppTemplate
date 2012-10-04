Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    
    launch: function() {
        var states = Ext.create('Ext.data.Store', {
            fields: ['name'],
            data : [
                {"name":"85"},
                {"name":"100"},
                {"name":"0"},
                {"name":"ProjectManager"}
            ]
        });


        this.stateCombo = this.add({
            xtype: 'combo',
            store: states,
            queryMode: 'local',
            displayField: 'name',
            valueField: 'name',
            listeners: {
                'select': this.onStateChange,
                scope: this
            }
        });
    },
       
    onStateChange: function(combo, record) {
        this.stateCombo.destroy();
        this.capacityNotificationView = Ext.create('Ext.panel.Panel', {
            bodyPadding: 20,
            border: 0,
            layout: 'hbox'
        });
        var state = record[0].get('name');
        if(state == '85') {
             Ext.create('CapacityUnderload', {
                viewport: this    
            });
        }
        if(state == '100') {
            Ext.create('CapacityOverload', {
                viewport: this
            });
        }
        if(state == '0') {
            Ext.create('OK', {
                viewport: this    
            });
        }
        if(state == 'ProjectManager') {
            Ext.create('ProjectManager', {
                viewport: this    
            });
        }
    }
        
});
