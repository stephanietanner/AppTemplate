Ext.define('CapacityOverload', {
    
    constructor: function(config) {
        this.initConfig(config);
        this.capacityNotificationView = Ext.create('Ext.panel.Panel', {
            bodyPadding: 20,
            border: 0,
            layout: 'column'
        });
        this.viewport = config.viewport;
        this._buildIterationCombo();
        
        this.viewport.add(this.capacityNotificationView);
    },
    
        
    _buildIterationCombo: function() {
        var iterationPanel = this.viewport.add({
             xtype: 'panel',
             border: 0,
             bodyPadding: 10,
        });
        this.iterationCombo = iterationPanel.add({
            xtype: 'rallyiterationcombobox',
            listeners: {
                ready: this._buildTaskGrid,
                scope: this
            }
        });
    },

    
    _buildTaskGrid: function() {
        var query = this.iterationCombo.getQueryFromSelected();
        Rally.data.ModelFactory.getModel({
            type: 'Task',
            scope: this,
            success: function(taskModel) {
                this.capacityNotificationView.add({
                    xtype: 'rallygrid',
                    model: taskModel,
                    width: '30%',
                    columnCfgs: [
                        'FormattedID',
                        'Name',
                        'Owner',
                        'State'
                    ],
                    storeConfig: {
                        filters: [{
        			        property: 'Owner',
					        value: Rally.environment.getContext().getUser()._ref
					    },
                        query
                        ]
                    },
                    listeners: {
                        select:  this._updateBurndown,
                        scope: this
                    }
                    
                });
                this._buildChartTaskBurndown();
            }
        });        
    },
    
    _updateBurndown: function(scope, record) {
        Ext.create('Rally.data.lookback.SnapshotStore', {
            listeners: {
                load: {
                    fn: this._buildChart,
                    scope:this
                }
            },
        
            autoLoad: true,
            fetch: ['ToDo'],
            start: 0,
            rawFind: { FormattedID: record.get('FormattedID')}
        });
        var taskBurndownPanel = Ext.getCmp('taskBurndownPanel');
        taskBurndownPanel.update(record.get("Name"));
    },
    
    _buildChartTaskBurndown: function() {
        this.capacityNotificationView.add({
            xtype: 'panel',
            id: 'taskBurndownPanel',
            itemId: 'taskBurndownPanel',
            width: '70%',
            border: 0
        });
    },
    
    _buildChart: function(store, records) {
        var fakeStore = this._getFakeStore(store, records);
        var chartConfig = {
            xtype : 'rallychart',
            id : 'chart',

//            store: store,
            store: fakeStore,

            height: 400,

            series : [
                {
                  type : 'line',
                  yField : 'ToDo',
                  name : 'To Do (h)',
                  visible : true
                }
            ],
            
            xField : '_ValidFrom',
            chartConfig : {
               chart : {
                marginRight : 130,
                marginBottom : 250,
                zoomType : 'x',
                animation : {
                  duration : 1500,
                  easing : 'swing'
                }
              },
              title : {
                text : 'Task Burndown',
                align: 'center'
              },
              xAxis : [{
                title : {
                  text : 'Days in Iteration',
                  margin : 40
                },
                labels : {
                  align: 'right',
                  rotation : 300
                }
              }],
              yAxis : {
                title : {
                  text : 'To Do (h)'
                },
                plotLines : [{
                  value : 0,
                  width : 1,
                  color : '#808080'
                }]
              },
              plotOptions : {
                  column: {
                      color: '#F00'                              
                  },
                series : {
                  animation : {
                    duration : 3000,
                    easing : 'swing'
                  }
                }
              },
              tooltip : {
                formatter : function() {
                  return this.x + ': ' + this.y;
                }
              },
              legend : {
                layout : 'vertical',
                align : 'right',
                verticalAlign : 'top',
                x : -10,
                y : 100,
                borderWidth : 0
              }
            
          }
        };
        var chartHolder = this.viewport.down('#taskBurndownPanel');
        chartHolder.removeAll(true);
        chartHolder.add(chartConfig);
    },
    
    _getFakeStore: function(store, record) {
        var fakeStore = Ext.create('Ext.data.Store', {
            fields: ['ToDo', '_ValidFrom'],
            data : [
                {"ToDo":Math.floor(Math.random()*11), "_ValidFrom":"10/09/2012"},
                {"ToDo":Math.floor(Math.random()*11), "_ValidFrom":"10/10/2012"},
                {"ToDo":Math.floor(Math.random()*11), "_ValidFrom":"10/11/2012"},
                {"ToDo":Math.floor(Math.random()*11), "_ValidFrom":"10/12/2012"}
            ]
        });
        
        return fakeStore;
    }
    
});
