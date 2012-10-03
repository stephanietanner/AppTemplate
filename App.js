Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',

    launch: function() {
        this.capacityNotificationView = Ext.create('Ext.panel.Panel', {
            bodyPadding: 20,
            border: 0,
            layout: 'hbox'
        });
        this.add(this.capacityNotificationView);
        this._buildTaskGrid();
    },

    
    _buildTaskGrid: function() {
        Rally.data.ModelFactory.getModel({
            type: 'Task',
            scope: this,
            success: function(taskModel) {
                this.capacityNotificationView.add({
                    xtype: 'rallygrid',
                    model: taskModel,
                    width: 500,
                    columnCfgs: [
                        'FormattedID',
                        'Name',
                        'Owner',
                        'State'
                    ],
                    storeConfig: {
                        filters: [{
    				        property: 'Owner',
					        value: Rally.environment.externalContext.user._ref
					    },

                        this._createWorkProductFilter()
                        ]
                    },
                    listeners: {
                        select: {
                            fn: this._updateBurndown,
                            scope: this
                        }
                    }
                    
                });
                this._buildChartTaskBurndown();
            }
        });        
    },
    
    _updateBurndown: function(scope, record) {
        var taskBurndownPanel = Ext.getCmp('taskBurndownPanel');
        taskBurndownPanel.update(record.get("Name"));
    },
    
    _buildChartTaskBurndown: function() {
        this.capacityNotificationView.add({
            xtype: 'panel',
            id: 'taskBurndownPanel',
            width: 500,
            border: 0,
            html: 'test'
        });
    },
    
    _createWorkProductFilter: function() {
        return Ext.create('Rally.data.QueryFilter', {
            property: 'WorkProduct',
            value: "https://hackathon.rallydev.com/slm/webservice/1.37/defect/6647967130"
        }).or({property: 'WorkProduct', value: "https://hackathon.rallydev.com/slm/webservice/1.37/defect/8132425479"});
    }
    
});
